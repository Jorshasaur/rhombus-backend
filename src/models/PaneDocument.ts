import {
    Model,
    Table,
    IsUUID,
    PrimaryKey,
    Default,
    DataType,
    Column,
    ForeignKey,
    AllowNull,
    BelongsTo
} from 'sequelize-typescript'
import { Document } from './Document'
import { Pane } from './Pane'

@Table({
    timestamps: true
})
export class PaneDocument extends Model<PaneDocument> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @IsUUID(4)
    @AllowNull(false)
    @ForeignKey(() => Pane)
    @Column(DataType.UUID)
    paneId: string

    @BelongsTo(() => Pane)
    pane: Pane

    @AllowNull(false)
    @Column
    teamId: string

    @IsUUID(4)
    @AllowNull(false)
    @ForeignKey(() => Document)
    @Column(DataType.UUID)
    documentId: string

    @BelongsTo(() => Document)
    document: Document

    @Column(DataType.JSONB)
    settings: string
}
