import { Logger } from './Logger'
import * as socketIo from 'socket.io'
import * as http from 'http'
import { Config } from '../config'
import * as _ from 'lodash'
import { QueueTaskPusher } from './QueueManager'
const redisAdapter = require('../lib/socket.io-redis')
import { Operation, PaneOperation } from '../interfaces/Operation'
import { MembershipPermissions } from '../interfaces/MembershipPermissions'
import { ErrorCollector } from './ErrorCollector'
import PermissionsService from '../services/permissions/Service'
import { parseEdgeContext } from '../middleware/InvisionUser'

export default class SocketManager {
    public static instance: SocketManager
    public static readonly WEB_SOCKET_LOCATION = '/rhombus-api/ws'
    public static readonly CONNECT = 'connection'
    public static readonly CURSOR = 'cursor'
    public static readonly DISCONNECT = 'disconnect'
    public static readonly UPDATE = 'update'
    public static readonly ERROR = 'error'
    public static readonly OPERATION = 'operation'
    public static readonly PANE_OPERATION = 'pane-operation'
    public static readonly COMMENTS_UPDATED = 'comments-updated'
    public static readonly DOCUMENT_ARCHIVED = 'document-archived'
    public static readonly DOCUMENT_UNARCHIVED = 'document-unarchived'
    public static readonly SUBSCRIBED_TO_DOCUMENT = 'subscribed-to-document'
    public static readonly DOCUMENT_PERMISSIONS_CHANGED =
        'document-permissions-changed'
    public static readonly FREEHAND_DOCUMENT_UPDATED =
        'freehand-document-updated'

    private logger: Logger
    private io: SocketIO.Server
    private server: http.Server

    public static getInstance() {
        if (this.instance === null || this.instance === undefined) {
            this.instance = new SocketManager()
        }
        return this.instance
    }

    private constructor() {
        this.logger = Logger
    }

    public setServer(server: http.Server) {
        this.server = server
        this.init()
    }

    public initWithoutServer() {
        this.init()
    }

    public close() {
        this.logger.debug('Closing socket connection')
        this.io.close()
    }

    private init() {
        let socketSettings: SocketIO.ServerOptions = {
            path: SocketManager.WEB_SOCKET_LOCATION,
            serveClient: false
        }
        if (Config.debugSockets) {
            socketSettings.pingInterval = 20000
            socketSettings.pingTimeout = 20000
        }
        this.io = socketIo(this.server, socketSettings)

        this.io.adapter(
            redisAdapter('', {
                host: Config.redis.host,
                port: Config.redis.port
            })
        )
        this.io.on(SocketManager.CONNECT, async (socket: SocketIO.Socket) => {
            let context = socket.handshake.headers['invision-edge-context']

            if (process.env.NODE_ENV === 'development') {
                context =
                    'eyJzZXNzaW9uX2lkIjoid3V4QU9LOThHclBzUGJvNzc1S2pZandMUmNiQ3g3Vkpsb2NhbCIsInVzZXJfaWQiOjEsInRlYW1faWQiOiJjamNqZW9pMncwMDAwcm4zNWMyM3E5OG91IiwiZW1haWwiOiJhZG1pbkBpbnZpc2lvbmFwcC5jb20ifQ=='
            }

            const [invisionUser, err] = parseEdgeContext(context)

            if (err) {
                socket.disconnect()
                return
            }

            const userMembership = await PermissionsService.hasDocumentMembership(
                {
                    userId: invisionUser.user_id,
                    documentId: socket.handshake.query.documentId
                }
            )

            if (userMembership == null) {
                ErrorCollector.notify(
                    'User is not allowed to connect to socket'
                )
                socket.disconnect()
                return
            }

            await socket.join('document-' + socket.handshake.query.documentId)
            await socket.join(
                'document-' + socket.handshake.query.documentId + '-panes'
            )

            QueueTaskPusher.getInstance().updateLastViewed({
                userId: socket.handshake.query.userId,
                documentId: socket.handshake.query.documentId
            })

            socket.on(SocketManager.CURSOR, (data: any) => {
                this.logger.info('[server](message): %s', JSON.stringify(data))
                socket.broadcast
                    .to('document-' + socket.handshake.query.documentId)
                    .emit(SocketManager.CURSOR, data)
            })

            socket.on(SocketManager.DISCONNECT, () => {
                this.logger.info('Client disconnected')
                this.sendUpdateEvent(
                    'document-' + socket.handshake.query.documentId,
                    socket
                )
            })

            this.sendUpdateEvent(
                'document-' + socket.handshake.query.documentId,
                socket
            )
        })

        this.io
            .of(SocketManager.WEB_SOCKET_LOCATION)
            .adapter.on(SocketManager.ERROR, (error) => {
                this.logger.fatal(
                    { err: error },
                    'SocketIO Redis Adapter Error'
                )
            })
    }

    private sendUpdateEvent(documentId: string, socket: SocketIO.Socket) {
        this.io
            .in(documentId)
            .clients((err: any, clients: any, userIds: any) => {
                // Removing duplicates here in case we have multiple connects from a single user
                userIds = _.uniq(userIds)
                const data = {
                    event: SocketManager.UPDATE,
                    users: userIds
                }
                // Broadcasting to all members so the joiner will also get presence info.
                this.io.to(documentId).emit(SocketManager.UPDATE, data)
            })
    }

    public emitOperation(documentId: string, data: Operation) {
        this.io.to('document-' + documentId).emit(SocketManager.OPERATION, data)
    }
    public emitPaneOperation(documentId: string, data: PaneOperation) {
        this.io
            .to('document-' + documentId + '-panes')
            .emit(SocketManager.PANE_OPERATION, data)
    }
    public sendCommentEvent(documentId: string) {
        this.logger.debug(`Send comment event for ${documentId}`)
        this.io
            .to(`document-${documentId}`)
            .emit(SocketManager.COMMENTS_UPDATED)
    }

    public sendDocumentArchivedEvent(documentId: string) {
        this.logger.debug(`Document ${documentId} changed to archived.`)
        this.io
            .to(`document-${documentId}`)
            .emit(SocketManager.DOCUMENT_ARCHIVED)
    }

    public sendDocumentUnArchivedEvent(documentId: string) {
        this.logger.debug(`Document ${documentId} changed to unarchived.`)
        this.io
            .to(`document-${documentId}`)
            .emit(SocketManager.DOCUMENT_UNARCHIVED)
    }

    public sendSubscribedToDocument(documentId: string, userId: number) {
        this.io
            .to(`document-${documentId}`)
            .emit(SocketManager.SUBSCRIBED_TO_DOCUMENT, { userId })
    }

    public sendDocumentPermissionsChanged(
        documentId: string,
        userId: number,
        permissions: MembershipPermissions
    ) {
        this.io
            .to(`document-${documentId}`)
            .emit(SocketManager.DOCUMENT_PERMISSIONS_CHANGED, {
                userId,
                permissions
            })
    }

    public sendFreehandUpdated(
        documentIds: string[],
        freehandDocumentId: number
    ) {
        let emission = this.io
        documentIds.forEach((id) => {
            emission.to(`document-${id}`)
        })
        return emission.emit(SocketManager.FREEHAND_DOCUMENT_UPDATED, {
            freehandDocumentId
        })
    }

    public sendPaneUpdated(documentIds: string[], data: PaneOperation) {
        let emission = this.io
        documentIds.forEach((id) => {
            emission.to(`document-${id}-panes`)
        })
        return emission.emit(SocketManager.PANE_OPERATION, data)
    }

    public sendGenericEvent(event: string, documentId: string) {
        this.io.to(`document-${documentId}`).emit(event)
    }
}
