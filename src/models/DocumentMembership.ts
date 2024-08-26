import {
    Table,
    AllowNull,
    BelongsTo,
    Column,
    Model,
    PrimaryKey,
    IsUUID,
    Default,
    DataType,
    ForeignKey
} from 'sequelize-typescript'
import analytics from '../analytics/analytics'
import { Document } from './Document'
import { PERMISSION_TYPES } from '../constants/AccessSettings'
import { MembershipPermissions } from '../interfaces/MembershipPermissions'
import { Transaction } from 'sequelize'
import SocketManager from '../util/SocketManager'
import { Sequelize } from 'sequelize-typescript'

@Table({
    timestamps: false,
    indexes: [
        {
            name: 'document_by_user',
            fields: ['documentId', 'userId']
        }
    ]
})
export class DocumentMembership extends Model<DocumentMembership> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @Column
    userId: number

    @IsUUID(4)
    @AllowNull(false)
    @ForeignKey(() => Document)
    @Column(DataType.UUID)
    documentId: string

    @AllowNull(false)
    @Default(PERMISSION_TYPES.EDIT)
    @Column(DataType.INTEGER)
    permissions: number

    @BelongsTo(() => Document)
    document: Document

    @Column(DataType.DATE)
    lastViewed: Date

    @AllowNull(true)
    @Default(null)
    @Column(DataType.BOOLEAN)
    isSubscribed: boolean | null

    /** Subscribe user only if user wasn't subscribed or unsubscribed before */
    public static async autoSubscribe(
        documentId: string,
        userId: number,
        method: 'edit' | 'comment',
        transaction?: Transaction
    ) {
        const documentMembership = await DocumentMembership.findOne({
            where: {
                userId,
                documentId
            },
            transaction
        })
        if (
            documentMembership != null &&
            documentMembership.isSubscribed == null
        ) {
            documentMembership.isSubscribed = true
            documentMembership.save({ transaction })
            SocketManager.getInstance().sendSubscribedToDocument(
                documentId,
                documentMembership.userId
            )

            analytics.track(
                analytics.DOCUMENT_FOLLOWED,
                userId,
                documentId,
                undefined,
                undefined,
                {
                    method: analytics.DOCUMENT_FOLLOWED_METHODS[method]
                }
            )
        }
    }

    public static getSubscribedMembers(documentId: string) {
        return DocumentMembership.findAll<DocumentMembership>({
            where: {
                documentId,
                isSubscribed: {
                    [Sequelize.Op.is]: true
                }
            }
        })
    }

    public permissionsObject(): MembershipPermissions {
        return {
            canEdit: this.permissions === PERMISSION_TYPES.EDIT,
            canComment: this.permissions === PERMISSION_TYPES.COMMENT
        }
    }
}
