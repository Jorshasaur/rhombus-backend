import { DocumentMembership } from '../models/DocumentMembership'
import { Sequelize } from 'sequelize-typescript'
import PermissionsService from '../services/permissions/Service'

export interface DocumentMembershipsResponse {
    canEdit: boolean
    canComment: boolean
}

interface MembershipsByDocumentId {
    [documentId: string]: DocumentMembership
}

interface PermissionsByDocumentId {
    [documentId: string]: DocumentMembershipsResponse
}

export async function getMembershipPermissionsForDocuments(
    userId: number,
    documentIds: string[]
) {
    const memberships = await DocumentMembership.findAll<DocumentMembership>({
        where: {
            userId,
            documentId: {
                [Sequelize.Op.in]: documentIds
            }
        }
    })

    const membershipsByDocumentId = memberships.reduce<MembershipsByDocumentId>(
        (res, membership) => {
            res[membership.documentId] = membership
            return res
        },
        {}
    )

    return documentIds.reduce<PermissionsByDocumentId>(
        (permissions, documentId) => {
            permissions[documentId] = getPermission(
                membershipsByDocumentId[documentId]
            )
            return permissions
        },
        {}
    )
}

/**
 * This check reads from the document membership table and understands the user's individual document
 * level access, which should be canEdit or canComment.
 */
export async function getMembershipPermissions(
    userId: number,
    documentId: string
): Promise<DocumentMembershipsResponse> {
    const membership = await PermissionsService.hasDocumentMembership({
        userId: userId,
        documentId: documentId
    })
    if (membership == null) {
        return { canEdit: false, canComment: false }
    }
    return membership.permissionsObject()
}

function getPermission(
    membership: DocumentMembership | undefined
): DocumentMembershipsResponse {
    if (membership == null) {
        return { canEdit: false, canComment: false }
    }
    return membership.permissionsObject()
}
