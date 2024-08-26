import * as Delta from 'quill-delta'
import {
    AfterCreate,
    AllowNull,
    BelongsTo,
    Column,
    DataType,
    Default,
    ForeignKey,
    IsUUID,
    Model,
    PrimaryKey,
    Table,
    Unique
} from 'sequelize-typescript'
import * as eventBusProducer from '../event-bus/producer/events'
import { FreehandHeaders } from '../interfaces/FreehandHeaders'
import { HookOptions } from '../interfaces/HookOptions'
import { Operation, DeltaOperation } from '../interfaces/Operation'
import { ReducedRequest } from '../interfaces/ReducedRequest'
import { ErrorCollector } from '../util/ErrorCollector'
import { QueueTaskPusher } from '../util/QueueManager'
import { ContentsOptions, Document } from './Document'
import { DocumentMembership } from './DocumentMembership'
import { Revision, StaticImplements } from '../interfaces/Revision'

export const SNAPSHOT_COEFFICIENT = 100
@Table({
    timestamps: true
})
@StaticImplements<Revision>()
export class DocumentRevision extends Model<DocumentRevision> {
    afterSubmitHooks = [
        this.createNewThumbnail,
        this.startDocumentSession,
        this.sendMentionEmail,
        this.sendUpdateEmail
    ]
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @AllowNull(false)
    @Column
    revision: number

    // @todo change delta to Delta.DeltaOperation[] - right now we have redundant ops key for each revision in database
    @AllowNull(false)
    @Column(DataType.JSONB)
    delta: { ops: Delta.DeltaOperation[] }

    @IsUUID(4)
    @AllowNull(false)
    @Unique
    @Column
    submissionId: string

    @AllowNull(true)
    @Column(DataType.JSONB)
    snapshot: Delta.DeltaOperation[] | null

    @AllowNull(false)
    @Column(DataType.DATE)
    sentAt: Date

    @IsUUID(4)
    @AllowNull(false)
    @ForeignKey(() => Document)
    @Column(DataType.UUID)
    documentId: string

    @AllowNull(false)
    @Default(false)
    @Column
    revert: boolean

    @BelongsTo(() => Document)
    document: Document

    @Column
    userId: number

    static async checkForSubmittedRevision(
        userId: number,
        data: Operation
    ): Promise<boolean> {
        const op = data as DeltaOperation
        const alreadySubmittedRevision = await DocumentRevision.findOne<
            DocumentRevision
        >({
            where: {
                submissionId: op.submissionId,
                documentId: op.documentId,
                userId
            }
        })
        return alreadySubmittedRevision != null
    }

    @AfterCreate
    static async addSnapshot(
        instance: DocumentRevision,
        hookOptions: HookOptions
    ) {
        if (
            instance.revision > 0 &&
            instance.revision % SNAPSHOT_COEFFICIENT === 0
        ) {
            QueueTaskPusher.getInstance().saveSnapshot({
                documentId: instance.documentId
            })
        }
    }

    @AfterCreate
    static async subscribeUser(
        instance: DocumentRevision,
        hookOptions: HookOptions
    ) {
        if (instance.userId != null) {
            DocumentMembership.autoSubscribe(
                instance.documentId,
                instance.userId,
                'edit',
                hookOptions.transaction
            )
        }
    }

    @AfterCreate
    static async updateTitle(
        instance: DocumentRevision,
        hookOptions: HookOptions
    ) {
        const document = (await instance.$get('document', {
            transaction: hookOptions.transaction
        })) as Document

        const options: ContentsOptions = {}
        if (hookOptions.transaction != null) {
            options.transaction = hookOptions.transaction
        }

        const contents = (await document.contents(options)).delta
        let title: string | undefined

        contents.eachLine((line: any, attributes: any, idx: any) => {
            title = line
                .map(function(op: any) {
                    if (typeof op.insert === 'string') {
                        return op.insert
                    } else {
                        return ''
                    }
                })
                .join('')

            return false
        })

        const originalTitle = document.title
        document.title = title || 'Untitled'

        if (originalTitle !== title) {
            this.emitDocumentRenamed(document)
        }

        await document.save({ transaction: hookOptions.transaction })
    }

    static emitDocumentRenamed(instance: Document) {
        eventBusProducer.documentRenamed(instance.teamId, instance.id)
    }

    @AfterCreate
    static async updateDocumentTimestamp(
        instance: DocumentRevision,
        hookOptions: HookOptions
    ) {
        const document = (await instance.$get(
            'document',
            hookOptions
        )) as Document

        document.updatedAt = instance.updatedAt
        document.changed('updatedAt', true)

        await document.save({ transaction: hookOptions.transaction })
    }

    @AfterCreate
    static async emitDocumentUpdated(
        instance: DocumentRevision,
        hookOptions: HookOptions
    ) {
        const document = (await instance.$get(
            'document',
            hookOptions
        )) as Document

        eventBusProducer.documentUpdated(document.teamId, document.id)
    }
    getOperation(): Object {
        return this.delta
    }
    getOperationCounts(): OperationCount {
        let delta = this.getQuillDelta()
        let operationCounts = {
            numberOfEdits: 0,
            numberOfDeletes: 0
        }

        delta.forEach(function(op: Delta.DeltaOperation) {
            if (op.hasOwnProperty('insert')) {
                operationCounts.numberOfEdits++
            } else if (op.hasOwnProperty('delete')) {
                operationCounts.numberOfDeletes++
            }
        })

        return operationCounts
    }
    public runAfterSubmitHooks(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders,
        documentId?: string
    ): void {
        this.afterSubmitHooks.map((hook) => {
            try {
                hook.apply(this, [userId, vendorId, req, headers])
            } catch (error) {
                ErrorCollector.notify(error, { req, severity: 'error' })
            }
        })
    }
    public getQuillDelta() {
        return new Delta(this.delta)
    }
    startDocumentSession(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders
    ) {
        let { numberOfEdits, numberOfDeletes } = this.getOperationCounts()

        QueueTaskPusher.getInstance().startDocumentSession({
            documentId: this.documentId,
            userId,
            vendorId,
            teamId: req.invision.user.teamId,
            numberOfEdits,
            numberOfDeletes
        })
    }
    sendMentionEmail(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders
    ) {
        if (isMentionOperation(this.delta)) {
            QueueTaskPusher.getInstance().sendMentionEmail({
                req,
                documentId: this.documentId,
                revision: this.revision,
                freehandHeaders: headers
            })
        }
    }
    sendUpdateEmail(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders
    ) {
        return QueueTaskPusher.getInstance().sendUpdateEmail({
            req,
            documentId: this.documentId,
            revision: this.revision,
            freehandHeaders: headers
        })
    }
    createNewThumbnail(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders
    ) {
        if (process.env.PAGES_THUMBNAILER_FUNCTION_ARN) {
            QueueTaskPusher.getInstance().createNewThumbnail({
                req,
                documentId: this.documentId,
                freehandHeaders: headers
            })
        }
    }
}

export function isMentionOperation(
    mentionOperation: DeltaOperation['operation']
) {
    const ops = mentionOperation.ops!
    if (ops.length === 1) {
        const op = ops[0].insert
        return (
            op != null && (op.mention != null || op['document-mention'] != null)
        )
    } else if (ops.length > 1) {
        const firstOp = ops[0].retain
        const secondOp = ops[1].insert
        return (
            firstOp != null &&
            secondOp != null &&
            (secondOp.mention != null || secondOp['document-mention'] != null)
        )
    }
    return false
}

export function DocumentRevisionsToDeltas(revisions: DocumentRevision[]) {
    return revisions.map((aRevision) => {
        return new Delta(aRevision.delta as any)
    })
}

export function transformDocumentOperation(
    clientOperation: Delta,
    concurrentRevisions: DocumentRevision[]
) {
    const concurrentOperations = DocumentRevisionsToDeltas(concurrentRevisions)

    concurrentOperations.forEach((op) => {
        clientOperation = op.transform(clientOperation, true)
    })

    return clientOperation
}
