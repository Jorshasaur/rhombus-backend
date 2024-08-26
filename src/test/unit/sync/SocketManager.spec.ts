import * as http from 'http'
import SocketManager from '../../../util/SocketManager'
import mockIo from '../../mocks/mock-socket-io'
import mockSocket from '../../mocks/mock-socket'
import { getDocumentMembershipRecord } from '../controllers/utils'
import { DocumentMembership } from '../../../models/DocumentMembership'
import { OperationType, PaneOperation } from '../../../interfaces/Operation'

function setImmediatePromise() {
    return new Promise(function(resolve: any) {
        setImmediate(resolve)
    })
}

function initSocketManager() {
    const socketManager = SocketManager.getInstance()
    const server: http.Server = null as any
    socketManager.setServer(server)
    return socketManager
}

describe('SocketManager', () => {
    beforeEach(() => {
        const record = getDocumentMembershipRecord()

        DocumentMembership.findOne = jest.fn(() => {
            return record
        })
    })

    it('should create instance of SocketManager', () => {
        const socketManager = SocketManager.getInstance()
        expect(socketManager).toBeInstanceOf(SocketManager)
    })

    it('should connect to socket', async () => {
        const socketManager = initSocketManager()

        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.CONNECT, socket)

        await setImmediatePromise()

        expect(socket.join).toBeCalledWith('document-1')
        expect(socket.on).toBeCalledWith(
            SocketManager.CURSOR,
            expect.any(Function)
        )
        expect(socket.on).toBeCalledWith(
            SocketManager.DISCONNECT,
            expect.any(Function)
        )
        expect(io.to('document-1').emit).toBeCalledWith(SocketManager.UPDATE, {
            event: 'update',
            users: [1, 2, 3]
        })
    })

    it('should not connect to socket if given user does not have permission', async () => {
        const record = getDocumentMembershipRecord()

        DocumentMembership.findOne = jest.fn(() => {
            return null
        })
        const socketManager = initSocketManager()
        socketManager.close = jest.fn()

        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, record.documentId, record.userId + 1)
        socket.handshake.headers['invision-edge-context'] =
            'eyJzZXNzaW9uX2lkIjoib3BQNjJad1JJNzNoWDZrODk1OUJFdVVhY2VEWDNjRTRsb2NhbCIsInVzZXJfaWQiOjksInRlYW1faWQiOiJjamNqZW9pMncwMDAwcm4zNWMyM3E5OG91IiwiZW1haWwiOiJtZW1iZXItdjdAaW52aXNpb25hcHAuY29tIn0='

        io.emit(SocketManager.CONNECT, socket)

        await setImmediatePromise()

        expect(socket.join).not.toBeCalled()
        expect(socket.on).not.toBeCalled()
        expect(socket.disconnect).toBeCalled()
    })

    it('should send operation', () => {
        const socketManager = initSocketManager()
        const io: mockIo = (socketManager as any).io

        const data = [{ insert: 'Test' }] as any
        socketManager.emitOperation('1', data)

        expect(io.to('document-1').emit).toBeCalledWith(
            SocketManager.OPERATION,
            data
        )
    })

    it('should send cursor updates', async () => {
        const socketManager = initSocketManager()

        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.CONNECT, socket)

        await setImmediatePromise()

        const cursor = {
            index: 1
        }
        socket.emit(SocketManager.CURSOR, cursor)

        expect(io.to('document-1').emit).toBeCalledWith(
            SocketManager.CURSOR,
            cursor
        )
    })

    it('should send update event after disconnect', async () => {
        const socketManager = initSocketManager()

        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.CONNECT, socket)

        await setImmediatePromise()

        socket.emit(SocketManager.DISCONNECT)

        expect(io.to('document-1').emit).toBeCalledWith(SocketManager.UPDATE, {
            event: 'update',
            users: [1, 2, 3]
        })
    })

    it('should send an updated comment event', async () => {
        const socketManager = initSocketManager()
        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.CONNECT, socket)
        await setImmediatePromise()
        socketManager.sendCommentEvent('1')

        expect(io.to('document-1').emit).toBeCalledWith(
            SocketManager.COMMENTS_UPDATED
        )
    })

    it('should send a document archived event', async () => {
        const socketManager = initSocketManager()
        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.CONNECT, socket)
        await setImmediatePromise()
        socketManager.sendDocumentArchivedEvent('1')

        expect(io.to('document-1').emit).toBeCalledWith(
            SocketManager.DOCUMENT_ARCHIVED
        )
    })

    it('should send a document unarchived event', async () => {
        const socketManager = initSocketManager()
        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.CONNECT, socket)
        await setImmediatePromise()
        socketManager.sendDocumentUnArchivedEvent('1')

        expect(io.to('document-1').emit).toBeCalledWith(
            SocketManager.DOCUMENT_UNARCHIVED
        )
    })

    it('should send a subscribed to document event', async () => {
        const socketManager = initSocketManager()
        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')
        const userId = 1

        io.emit(SocketManager.CONNECT, socket)
        await setImmediatePromise()
        socketManager.sendSubscribedToDocument('1', userId)

        expect(io.to('document-1').emit).toBeCalledWith(
            SocketManager.SUBSCRIBED_TO_DOCUMENT,
            {
                userId
            }
        )
    })

    it('should send a freehand document updated event', async () => {
        const socketManager = initSocketManager()
        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.FREEHAND_DOCUMENT_UPDATED, socket)
        await setImmediatePromise()
        socketManager.sendFreehandUpdated(['12345', '67890'], 1)

        expect(io.rooms['document-12345']).toBeInstanceOf(mockSocket)
        expect(io.rooms['document-67890']).toBeInstanceOf(mockSocket)
        expect(io.emit).toBeCalledWith(
            SocketManager.FREEHAND_DOCUMENT_UPDATED,
            { freehandDocumentId: 1 }
        )
    })

    it('should send a pane updated event', async () => {
        const socketManager = initSocketManager()
        const io: mockIo = (socketManager as any).io
        const socket = new mockSocket(io, '1')

        io.emit(SocketManager.PANE_OPERATION, socket)
        await setImmediatePromise()
        const data = {
            operation: { ops: [] },
            type: OperationType.JSON1,
            paneId: '1234',
            documentId: 'aabb',
            submissionId: '12345',
            revision: 12,
            revert: false
        } as PaneOperation
        socketManager.sendPaneUpdated(['12345', '67890'], data)

        expect(io.rooms['document-12345-panes']).toBeInstanceOf(mockSocket)
        expect(io.rooms['document-67890-panes']).toBeInstanceOf(mockSocket)
        expect(io.emit).toBeCalledWith(SocketManager.PANE_OPERATION, data)
    })
})
