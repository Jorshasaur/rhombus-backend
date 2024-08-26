import { Request, Response, NextFunction } from 'express'
import { Document } from '../models/Document'
import { PermissionsActions as Actions } from '../services/permissions/Actions'
import PermissionsService from '../services/permissions/Service'
import { ReducedRequest } from '../interfaces/ReducedRequest'

export async function PermissionsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (
        req.originalUrl === '/healthcheck' ||
        req.originalUrl.includes('/private/')
    ) {
        return next()
    }

    req.permissions = new Permissions(
        req.invision!.user!.userId,
        req.invision!.user!.teamId,
        req
    )

    next()
}

export class PermissionsError extends Error {
    reason: string

    constructor(message: string | undefined, reason: string) {
        super(message)
        this.name = 'Permissions Error'
        this.reason = reason
    }
}

/**
 * Permissions checks go through three different levels:
 * 1. The index-api permissions check, which is mostly to check for any kind of override that could be coming from spaces
 * 2. Individual document membership, which would be canComment or canEdit
 * 3. Document level permissions for visibility (mostly just used for joining)
 *
 * The assumption is that once we reach a permission that says false that we immediately break out of all other checks (except the override)
 * and return that false.  The only time we immediately break out with a true result is when that true result comes from #1.
 */
export class Permissions {
    permissionsService: PermissionsService
    INVALID_PERMISSION_MSG: 'The user does not have permission to perform this action.'

    constructor(
        private userId: number,
        private teamId: string,
        req: Request | ReducedRequest
    ) {
        this.permissionsService = new PermissionsService(
            this.userId,
            this.teamId,
            req
        )
    }

    public async canJoinAndViewDocument(document: Document) {
        const permissionRes = await this.permissionsService.hasJoinAndViewPermissionForDocument(
            document
        )
        if (permissionRes != null) {
            throw new PermissionsError(
                this.INVALID_PERMISSION_MSG,
                permissionRes
            )
        }

        return true
    }

    public async canCreateDocument(spaceId: string | undefined) {
        if (!spaceId) {
            spaceId = '0'
        }

        return this.hasPermissionForSpace(Actions.DOCUMENT_CREATE, spaceId)
    }

    // TODO: we should have a meeting discussing the business rules for when someone
    // can view a document so we cover all the cases possible.
    public canViewDocument(document: Document) {
        return this.hasPermissionForDocument(Actions.DOCUMENT_VIEW, document)
    }

    public async canJoinDocument(document: Document) {
        const permissionRes = await this.permissionsService.hasJoinPermissionForDocument(
            document
        )
        if (permissionRes != null) {
            throw new PermissionsError(
                this.INVALID_PERMISSION_MSG,
                permissionRes
            )
        }

        return true
    }

    // canViewDocument is currently tied to DocumentMemberships and not if a user
    // could see the document after a join. That's why we have to combine the 2 to
    // cover both cases of if a user can have mentions sent
    public async canSendMentionForDocument(document: Document) {
        let canView = await this.canViewDocument(document).catch(() => false)
        if (canView) {
            return true
        }
        return await this.canJoinDocument(document).catch(() => false)
    }

    public canAddMembersToDocument(document: Document) {
        return this.hasPermissionForDocument(
            Actions.DOCUMENT_ADD_MEMBERS,
            document
        )
    }

    public canRemoveMembersFromDocument(
        document: Document,
        errorOnFalse: boolean = true
    ) {
        return this.hasPermissionForDocument(
            Actions.DOCUMENT_REMOVE_MEMBERS,
            document,
            errorOnFalse
        )
    }

    public canArchiveDocument(document: Document) {
        return this.hasPermissionForDocument(Actions.DOCUMENT_ARCHIVE, document)
    }

    public canChangeDocument(document: Document) {
        return this.hasPermissionForDocument(Actions.DOCUMENT_CHANGE, document)
    }

    public async canSubmitOperation(document: Document) {
        const permissionRes = await this.permissionsService.canSubmitOperationForDocument(
            document
        )
        if (permissionRes != null) {
            throw new PermissionsError(
                this.INVALID_PERMISSION_MSG,
                permissionRes
            )
        }

        return true
    }

    public canCommentOnDocument(document: Document) {
        return this.hasPermissionForDocument(Actions.DOCUMENT_COMMENT, document)
    }

    public canPrivateCommentOnDocument(document: Document) {
        return this.hasPermissionForDocument(
            Actions.DOCUMENT_PRIVATE_COMMENT,
            document
        )
    }

    public canEditDocumentLinkSettings(document: Document) {
        return this.hasPermissionForDocument(
            Actions.DOCUMENT_MANAGE_PUBLIC_LINK,
            document
        )
    }

    public canDeleteComment(document: Document) {
        return this.hasPermissionForDocument(Actions.COMMENT_DELETE, document)
    }

    public canResolveComment(document: Document) {
        return this.hasPermissionForDocument(Actions.COMMENT_RESOLVE, document)
    }

    public canChangeComment(document: Document) {
        return this.hasPermissionForDocument(Actions.COMMENT_CHANGE, document)
    }

    public canMentionDocumentMember(document: Document) {
        return this.hasPermissionForDocument(
            Actions.COMMENT_MENTION_DOCUMENT_MEMBER,
            document
        )
    }

    public canMentionTeamMember(document: Document) {
        return this.hasPermissionForDocument(
            Actions.COMMENT_MENTION_TEAM_MEMBER,
            document
        )
    }

    public canInviteGuest(document: Document) {
        return this.hasPermissionForDocument(
            Actions.DOCUMENT_ADD_GUESTS,
            document
        )
    }

    private async hasPermissionForSpace(action: Actions, spaceId: string) {
        const permissionRes = await this.permissionsService.hasPermissionForSpace(
            action,
            spaceId
        )
        if (permissionRes != null) {
            throw new PermissionsError(
                this.INVALID_PERMISSION_MSG,
                permissionRes
            )
        }

        return true
    }

    private async hasPermissionForDocument(
        action: Actions,
        document: Document,
        errorOnFalse: boolean = true
    ) {
        const permissionRes = await this.permissionsService.hasPermissionForDocument(
            action,
            document
        )
        if (permissionRes != null) {
            if (errorOnFalse) {
                throw new PermissionsError(
                    this.INVALID_PERMISSION_MSG,
                    permissionRes
                )
            }
            return false
        }

        return true
    }
}
