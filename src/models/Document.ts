import * as cuid from 'cuid'
import * as Delta from 'quill-delta'
import { Transaction, WhereOptions } from 'sequelize'
import {
    AfterCreate,
    AfterDestroy,
    AllowNull,
    Column,
    DataType,
    Default,
    DefaultScope,
    HasMany,
    IFindOptions,
    IsUUID,
    Model,
    PrimaryKey,
    Scopes,
    Sequelize,
    Table
} from 'sequelize-typescript'
import { v4 as uuid } from 'uuid'
import { PERMISSION_TYPES, VISIBILITY_TYPES } from '../constants/AccessSettings'
import * as eventBusProducer from '../event-bus/producer/events'
import { DocumentContents } from '../interfaces/DocumentContents'
import { HookOptions } from '../interfaces/HookOptions'
import { MembershipPermissions } from '../interfaces/MembershipPermissions'
import DeltaDiff from '../util/DeltaDiff'
import * as DeltaUtils from '../util/DeltaUtils'
import { Asset } from './Asset'
import { DocumentMembership } from './DocumentMembership'
import { DocumentRevision } from './DocumentRevision'
import { Pane } from './Pane'

export interface ContentsOptions {
    transaction?: Transaction
}

export interface SaveSnapshotOptions extends ContentsOptions {}

@DefaultScope({
    where: { isArchived: false }
})
@Scopes({
    archived: {
        where: { isArchived: true }
    }
})
@Table({
    timestamps: true
})
export class Document extends Model<Document> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @Column
    title: string

    @Column
    ownerId: number

    @Column
    teamId: string

    @AllowNull(false)
    @Default(false)
    @Column
    isArchived: boolean

    @Column(DataType.DATE)
    archivedAt: Date | null

    @Default(PERMISSION_TYPES.EDIT)
    @Column
    permissions: number

    @Default(VISIBILITY_TYPES.ALL)
    @Column
    visibility: number

    @IsUUID(4)
    @AllowNull(true)
    @Column(DataType.UUID)
    thumbnailAssetKey: string

    @HasMany(() => DocumentRevision)
    revisions: DocumentRevision[]

    @HasMany(() => DocumentMembership)
    memberships: DocumentMembership[]

    @HasMany(() => Asset)
    assets: Asset[]

    @AfterCreate
    static async addInitialDelta(instance: Document, hookOptions: HookOptions) {
        await instance.$create(
            'revision',
            {
                revision: 0,
                delta: new Delta([
                    { insert: '\n', attributes: { id: cuid() } },
                    { insert: '\n', attributes: { id: cuid() } }
                ]),
                submissionId: uuid(),
                sentAt: new Date()
            },
            { transaction: hookOptions.transaction }
        )
        await instance.$create(
            'membership',
            {
                userId: instance.ownerId,
                isSubscribed: true
            },
            { transaction: hookOptions.transaction }
        )
    }

    @AfterCreate
    static emitDocumentCreated(instance: Document) {
        eventBusProducer.documentCreated(
            instance.teamId,
            instance.ownerId,
            instance.id
        )
    }

    @AfterDestroy
    static emitDocumentDeleted(instance: Document) {
        eventBusProducer.documentDeleted(instance.teamId, instance.id)
    }

    public static async findDocument(
        documentId: string,
        teamId: string,
        options: IFindOptions<Document> = {}
    ) {
        options.where = Object.assign({ id: documentId, teamId }, options.where)
        return Document.unscoped().findOne<Document>(options)
    }

    public static async findDocumentAsGuest(
        documentId: string,
        options: IFindOptions<Document> = {}
    ) {
        options.where = Object.assign({ id: documentId })
        return Document.unscoped().findOne<Document>(options)
    }

    public async saveSnapshot(options: SaveSnapshotOptions = {}) {
        const { revision, delta } = await this.contents(options)

        const lastRevision = (await DocumentRevision.findOne({
            where: {
                documentId: this.id,
                revision
            },
            transaction: options.transaction
        })) as DocumentRevision

        lastRevision.snapshot = delta.ops!
        return lastRevision.save({
            transaction: options.transaction
        })
    }

    public async contents(
        options: ContentsOptions = {},
        atRevision?: number
    ): Promise<DocumentContents> {
        let lastSnapshotRevision
        let lastRevision
        // If there is a specified revision, attempt to get a snapshot at or before that revision
        // and get the last document revision at that revision
        if (atRevision || atRevision === 0) {
            lastSnapshotRevision = await DocumentRevision.findOne({
                where: {
                    documentId: this.id,
                    revision: {
                        [Sequelize.Op.lte]: atRevision
                    },
                    snapshot: {
                        [Sequelize.Op.ne]: null
                    }
                },
                order: [['revision', 'DESC']],
                transaction: options.transaction
            })

            lastRevision = (await DocumentRevision.findOne({
                where: {
                    documentId: this.id,
                    revision: {
                        [Sequelize.Op.lte]: atRevision
                    }
                },
                order: [['revision', 'DESC']],
                transaction: options.transaction
            })) as DocumentRevision

            // Otherwise attempt to get the last document snapshot, and get the last revision
        } else {
            lastSnapshotRevision = await DocumentRevision.findOne({
                where: {
                    documentId: this.id,
                    snapshot: {
                        [Sequelize.Op.ne]: null
                    }
                },
                order: [['revision', 'DESC']],
                transaction: options.transaction
            })

            lastRevision = (await DocumentRevision.findOne({
                where: {
                    documentId: this.id
                },
                order: [['revision', 'DESC']],
                transaction: options.transaction
            })) as DocumentRevision
        }

        // if snapshot exists and has same revision as last revision then return snapshot
        if (
            lastSnapshotRevision != null &&
            lastSnapshotRevision.revision === lastRevision.revision
        ) {
            return {
                revision: lastRevision.revision,
                delta: new Delta(lastSnapshotRevision.snapshot!)
            }
        }

        let document: Delta
        let where = {
            revision: {
                [Sequelize.Op.lte]: lastRevision.revision
            }
        }

        if (lastSnapshotRevision != null) {
            // if snapshot exists get only revisions greater then revision with snapshot
            where = {
                revision: {
                    [Sequelize.Op.gt]: lastSnapshotRevision.revision,
                    [Sequelize.Op.lte]: lastRevision.revision
                }
            }
            document = new Delta(lastSnapshotRevision.snapshot!)
        } else {
            document = new Delta()
        }

        let revisions = await this.getRevisionsHelper(
            where,
            options.transaction
        )

        revisions.forEach((revision: DocumentRevision) => {
            document = document.compose(revision.getQuillDelta())
        })

        return {
            revision: revisions[revisions.length - 1].revision,
            delta: document
        }
    }

    public async members(): Promise<DocumentMembership[]> {
        let members = (await this.$get('memberships', {
            order: [['userId', 'ASC']]
        })) as DocumentMembership[]

        return members
    }

    public permissionsObject(): MembershipPermissions {
        return {
            canEdit: this.permissions === PERMISSION_TYPES.EDIT,
            canComment: this.permissions === PERMISSION_TYPES.COMMENT
        }
    }

    private async getRevisionsHelper(
        where?: WhereOptions<DocumentRevision>,
        transaction?: Transaction
    ): Promise<DocumentRevision[]> {
        return (await this.$get('revisions', {
            where,
            order: [['revision', 'ASC']],
            transaction
        })) as DocumentRevision[]
    }

    public async getRevision(
        revisionId: number
    ): Promise<DocumentRevision | null> {
        let revisions = await this.getRevisionsHelper({
            revision: revisionId
        })

        if (revisions.length) {
            return revisions[0]
        }
        return null
    }

    public async getRevisionsAfterRevision(
        revisionId: number,
        includeRevision: boolean = false,
        transaction?: Transaction
    ): Promise<DocumentRevision[]> {
        let where: Object = {
            revision: {
                $gt: revisionId
            }
        }

        if (includeRevision) {
            where = {
                revision: {
                    $gte: revisionId
                }
            }
        }

        return await this.getRevisionsHelper(where, transaction)
    }

    public async getDiff(
        revision: number,
        panes?: { [paneId: string]: Pane | undefined }
    ) {
        // Get revisions before the current revision
        const previousContents = await this.contents(undefined, revision)
        const previousDocumentDelta = DeltaUtils.removeNonInsertOperations(
            previousContents.delta
        )

        // Get the current document contents
        let currentContents = await this.contents()
        // If there are panes we need to mark those Deltas to pick up the change
        if (panes) {
            currentContents = DeltaUtils.markPaneDeltas(currentContents, panes)
        }

        const currentDocumentDelta = DeltaUtils.removeNonInsertOperations(
            currentContents.delta
        )

        // Get the diff between the previous document state and the current
        const diff = DeltaDiff(previousDocumentDelta, currentDocumentDelta)

        // If there is a diff, loop through it and apply the 'added' attribute to each insertion
        if (diff.ops && diff.ops.length) {
            diff.ops.forEach((op) => {
                if (op.hasOwnProperty('insert')) {
                    op.attributes = Object.assign({}, op.attributes, {
                        added: true
                    })
                }
            })
        }

        // Return the composed document with added attributes on newly added data
        const composedDoc = previousDocumentDelta.compose(diff)

        // Mark space as added if next word after space is added
        const len = composedDoc.ops!.length - 1
        composedDoc.forEach((op: Delta.DeltaOperation, index: number) => {
            if (op.insert === ' ' && index > 0 && index < len) {
                const next = composedDoc.ops![index + 1]

                if (next.attributes != null && next.attributes.added) {
                    op.attributes = Object.assign({}, op.attributes, {
                        added: true
                    })
                }
            }
        })

        return composedDoc
    }
}
