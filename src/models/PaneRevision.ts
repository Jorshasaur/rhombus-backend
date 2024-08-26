import {
    Model,
    Table,
    IsUUID,
    PrimaryKey,
    Default,
    DataType,
    Column,
    AllowNull,
    Unique,
    ForeignKey,
    BelongsTo,
    AfterCreate
} from 'sequelize-typescript'
import { Pane } from './Pane'
import * as json1 from 'ot-json1'
import { Revision, StaticImplements } from '../interfaces/Revision'
import { Operation, PaneOperation } from '../interfaces/Operation'
import { ReducedRequest } from '../interfaces/ReducedRequest'
import { FreehandHeaders } from '../interfaces/FreehandHeaders'
import { HookOptions } from '../interfaces/HookOptions'
import { QueueTaskPusher } from '../util/QueueManager'
import { Pane as IPane } from '../interfaces/PaneContents'
import { ErrorCollector } from '../util/ErrorCollector'
import { isMentionOperation } from './DocumentRevision'

export const PANE_SNAPSHOT_COEFFICIENT = 100

@Table({
    timestamps: true
})
@StaticImplements<Revision>()
export class PaneRevision extends Model<PaneRevision> {
    afterSubmitHooks = [this.sendUpdateEmail, this.sendMentionEmail]

    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @AllowNull(false)
    @Column
    revision: number

    @IsUUID(4)
    @AllowNull(false)
    @Unique
    @Column
    submissionId: string

    @IsUUID(4)
    @AllowNull(false)
    @ForeignKey(() => Pane)
    @Column(DataType.UUID)
    paneId: string

    @BelongsTo(() => Pane)
    pane: Pane

    @Column
    userId: number

    @AllowNull(false)
    @Column
    teamId: string

    @AllowNull(false)
    @Column(DataType.JSONB)
    operation: json1.JSONOp

    @AllowNull(true)
    @Column(DataType.JSONB)
    snapshot: IPane

    @AllowNull(false)
    @Default(false)
    @Column
    revert: boolean

    static async checkForSubmittedRevision(
        userId: number,
        data: Operation
    ): Promise<boolean> {
        const op = data as PaneOperation
        const alreadySubmittedRevision = await PaneRevision.findOne<
            PaneRevision
        >({
            where: {
                submissionId: op.submissionId,
                paneId: op.paneId,
                userId
            }
        })
        return alreadySubmittedRevision != null
    }

    @AfterCreate
    static async addSnapshot(instance: PaneRevision, hookOptions: HookOptions) {
        if (
            instance.revision > 0 &&
            instance.revision % PANE_SNAPSHOT_COEFFICIENT === 0
        ) {
            QueueTaskPusher.getInstance().savePanesSnapshot({
                paneId: instance.paneId,
                teamId: instance.teamId
            })
        }
    }

    getOperation(): Object {
        return { ops: this.operation }
    }

    public runAfterSubmitHooks(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders,
        documentId: string
    ): void {
        this.afterSubmitHooks.map((hook) => {
            try {
                hook.apply(this, [userId, vendorId, req, headers, documentId])
            } catch (error) {
                ErrorCollector.notify(error, { req, severity: 'error' })
            }
        })
    }

    public sendUpdateEmail(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders,
        documentId: string
    ) {
        const data = {
            req,
            documentId,
            freehandHeaders: headers,
            panes: {}
        }
        data.panes[this.paneId] = this.revision
        return QueueTaskPusher.getInstance().sendUpdateEmail(data)
    }

    public sendMentionEmail(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders,
        documentId: string
    ) {
        if (isPaneMentionOperation(this.operation)) {
            QueueTaskPusher.getInstance().sendMentionEmail({
                req,
                documentId: documentId,
                paneId: this.paneId,
                revision: this.revision,
                freehandHeaders: headers
            })
        }
    }
}

export function isPaneMentionOperation(operation: json1.JSONOp): boolean {
    if (operation.length !== 6) {
        return false
    }

    const editOp = operation[5] as json1.JSONOpComponent
    if (editOp.et !== 'rich-text' || !editOp.e) {
        return false
    }

    return isMentionOperation(editOp.e)
}

export function transformPaneOperation(
    clientOperation: json1.JSONOp,
    concurrentRevisions: PaneRevision[]
) {
    concurrentRevisions.forEach((serverOperation) => {
        clientOperation = json1.type.transformNoConflict(
            clientOperation,
            serverOperation.operation,
            'left'
        )
    })
    return clientOperation
}
