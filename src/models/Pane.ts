import * as cuid from 'cuid'
import * as json1 from 'ot-json1'
import * as Delta from 'quill-delta'
import { Transaction, WhereOptions } from 'sequelize'
import {
    AfterCreate,
    AllowNull,
    BelongsTo,
    BelongsToMany,
    Column,
    DataType,
    Default,
    ForeignKey,
    HasMany,
    IFindOptions,
    IsUUID,
    Model,
    PrimaryKey,
    Sequelize,
    Table
} from 'sequelize-typescript'
import { v4 as uuid } from 'uuid'
import { HookOptions } from '../interfaces/HookOptions'
import { PaneContents, PaneElementType } from '../interfaces/PaneContents'
import { ContentsOptions, Document, SaveSnapshotOptions } from './Document'
import { PaneDocument } from './PaneDocument'
import { PaneRevision } from './PaneRevision'

json1.type.registerSubtype(require('rich-text'))

function createInitialText() {
    return {
        type: PaneElementType.TEXT,
        id: uuid(),
        value: new Delta([
            {
                insert: '\n',
                attributes: { id: cuid() }
            }
        ])
    }
}

export function createInitialRow() {
    return {
        id: uuid(),
        elements: [createInitialText(), createInitialText()]
    }
}

@Table({
    timestamps: true
})
export class Pane extends Model<Pane> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @Column
    title: string

    @AllowNull(false)
    @Column
    teamId: string

    @AllowNull(false)
    @Column
    owningUserId: number

    @IsUUID(4)
    @AllowNull(false)
    @ForeignKey(() => Document)
    @Column(DataType.UUID)
    owningDocumentId: string

    @BelongsTo(() => Document)
    owningDocument: Document

    @BelongsToMany(
        () => Document,
        () => PaneDocument
    )
    documents: Document[]

    @HasMany(() => PaneRevision)
    revisions: PaneRevision[]

    public static async findPane(
        paneId: string,
        teamId: string,
        options: IFindOptions<Pane> = {}
    ) {
        options.where = Object.assign({ id: paneId, teamId }, options.where)
        return Pane.findOne<Pane>(options)
    }

    private async getRevisionsHelper(
        where?: WhereOptions<PaneRevision>,
        transaction?: Transaction
    ) {
        return this.$get<PaneRevision>('revisions', {
            where,
            order: [['revision', 'ASC']],
            transaction
        }) as PromiseLike<PaneRevision[]>
    }

    public async getRevision(revisionId: number): Promise<PaneRevision | null> {
        let revisions = await this.getRevisionsHelper({
            revision: revisionId
        })

        if (revisions && revisions.length) {
            return revisions[0]
        }
        return null
    }

    public async getRevisionsAfterRevision(
        revisionId: number,
        includeRevision: boolean = false,
        transaction?: Transaction
    ) {
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

        return this.getRevisionsHelper(where, transaction)
    }

    public async contents(
        options: ContentsOptions = {},
        atRevision?: number
    ): Promise<PaneContents> {
        let lastSnapshotRevision
        let lastRevision
        // If there is a specified revision, attempt to get a snapshot at or before that revision
        // and get the last pane revision at that revision
        if (atRevision) {
            lastSnapshotRevision = await PaneRevision.findOne({
                where: {
                    paneId: this.id,
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

            lastRevision = (await PaneRevision.findOne({
                where: {
                    paneId: this.id,
                    revision: {
                        [Sequelize.Op.lte]: atRevision
                    }
                },
                order: [['revision', 'DESC']],
                transaction: options.transaction
            })) as PaneRevision

            // Otherwise attempt to get the last pane snapshot, and get the last revision
        } else {
            lastSnapshotRevision = await PaneRevision.findOne({
                where: {
                    paneId: this.id,
                    snapshot: {
                        [Sequelize.Op.ne]: null
                    }
                },
                order: [['revision', 'DESC']],
                transaction: options.transaction
            })

            lastRevision = (await PaneRevision.findOne({
                where: {
                    paneId: this.id
                },
                order: [['revision', 'DESC']],
                transaction: options.transaction
            })) as PaneRevision
        }

        // if snapshot exists and has same revision as last revision then return snapshot
        if (
            lastSnapshotRevision != null &&
            lastSnapshotRevision.revision === lastRevision.revision
        ) {
            return {
                revision: lastRevision.revision,
                contents: json1.type.create(lastSnapshotRevision.snapshot!)
            }
        }

        let document: Pane | {} = {}
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
            document = json1.type.create(lastSnapshotRevision.snapshot!)
        }

        let revisions = await this.getRevisionsHelper(
            where,
            options.transaction
        )

        const revs = revisions
            .map((rev) => rev.operation)
            .reduce(json1.type.compose)

        return {
            revision: revisions[revisions.length - 1].revision,
            contents: json1.type.apply(document, revs)
        }
    }

    public async saveSnapshot(options: SaveSnapshotOptions = {}) {
        const { revision, contents } = await this.contents(options)

        const lastRevision = (await PaneRevision.findOne({
            where: {
                paneId: this.id,
                revision
            },
            transaction: options.transaction
        })) as PaneRevision

        lastRevision.snapshot = contents
        return lastRevision.save({
            transaction: options.transaction
        })
    }

    @AfterCreate
    static async addInitialRevision(instance: Pane, hookOptions: HookOptions) {
        await instance.$create(
            'revision',
            {
                revision: 0,
                userId: instance.owningUserId,
                teamId: instance.teamId,
                revert: false,
                submissionId: uuid(),
                sentAt: new Date(),
                operation: [
                    [
                        'elements',
                        {
                            i: [createInitialRow(), createInitialRow()]
                        }
                    ],
                    ['id', { i: `${instance.id}` }],
                    ['metadata', { i: { columnSizes: { '0': 50, '1': 50 } } }],
                    ['viewType', { i: 'table' }]
                ]
            },
            { transaction: hookOptions.transaction }
        )
    }

    public async duplicate(
        documentId: string,
        owningUserId: string,
        transaction: Transaction
    ) {
        const contents = await this.contents()
        const copy = await Pane.create(
            {
                title: this.title,
                // Protecting against team data leakage here by enforcing duping into the same team
                teamId: this.teamId,
                owningDocumentId: documentId,
                owningUserId
            },
            { transaction }
        )
        const lastRevision = (await PaneRevision.findOne({
            where: {
                paneId: copy.id,
                revision: 0
            },
            transaction
        })) as PaneRevision
        const pane = contents.contents
        pane.id = copy.id
        lastRevision.snapshot = pane
        await lastRevision.save({ transaction })
        return copy.id
    }
}
