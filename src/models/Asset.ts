import {
    Table,
    Column,
    Model,
    PrimaryKey,
    AllowNull,
    BelongsTo,
    IsUUID,
    Default,
    DataType,
    ForeignKey
} from 'sequelize-typescript'
import { Document } from './Document'

@Table({
    timestamps: true
})
export class Asset extends Model<Asset> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @IsUUID(4)
    @AllowNull(false)
    @ForeignKey(() => Document)
    @Column(DataType.UUID)
    documentId: string

    @BelongsTo(() => Document)
    document: Document

    @IsUUID(4)
    @AllowNull(false)
    @Column(DataType.UUID)
    assetKey: string

    @AllowNull(false)
    @Column
    fileName: string

    @Default(false)
    @AllowNull(false)
    @Column
    uploaded: boolean
}
