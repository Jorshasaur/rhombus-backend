import { IndexApiService } from '../IndexApiService'
import { Request } from 'express'
import { Document } from '../../models/Document'
import { DocumentMembership } from '../../models/DocumentMembership'
import { Permission } from '../../interfaces/Permission'
import rules, { RuleType } from './Rules'
import {
    PERMISSION_TYPES,
    VISIBILITY_TYPES,
    PermissionErrorReason
} from '../../constants/AccessSettings'
import { PermissionsActions } from './Actions'
import { Logger } from '../../util/Logger'
import { ReducedRequest } from '../../interfaces/ReducedRequest'
import { ErrorCollector } from '../../util/ErrorCollector'

interface ActionsPermission {
    [action: string]: Permission
}

interface DocumentPermissions {
    [documentId: string]: ActionsPermission
}

export default class PermissionsService {
    private indexApiService: IndexApiService
    private logger: Logger

    static async hasDocumentMembership({
        documentId,
        userId
    }: {
        documentId: string
        userId: number
    }) {
        return DocumentMembership.findOne({
            where: {
                userId,
                documentId
            }
        })
    }

    constructor(
        private userId: number,
        private teamId: string,
        private req: Request | ReducedRequest
    ) {
        this.indexApiService = new IndexApiService(this.req)
        this.logger = Logger
    }

    async permissionsForDocuments(
        documents: Document[],
        actions: PermissionsActions[]
    ): Promise<DocumentPermissions | undefined> {
        const documentIds = documents.map((d) => d.id).join(',')

        const externalRes = await this.indexApiService.GetPermissionsForDocument(
            actions.join(','),
            documentIds,
            this.userId,
            this.teamId,
            this.req.tracing
        )

        if (externalRes == null || externalRes.data == null) {
            return
        }

        const externalData = externalRes.data

        return documents.reduce((res: DocumentPermissions, document) => {
            res[document.id] = this.permissionsForDocumentAndMembership(
                document,
                document.memberships[0],
                actions,
                externalData[document.id]
            )
            return res
        }, {})
    }

    async hasPermissionForSpace(action: PermissionsActions, spaceId: string) {
        const externalRes = await this.indexApiService.GetPermissionsForSpace(
            action,
            this.userId,
            this.teamId,
            spaceId,
            this.req.tracing
        )

        if (
            externalRes == null ||
            externalRes.data == null ||
            externalRes.data[spaceId] == null
        ) {
            this.reportExternalPermissionError([action], externalRes)
            return PermissionErrorReason.EXTERNAL
        }

        const permission = externalRes.data[spaceId]

        const [superAllow] = this.getExternalPermission(action, permission)
        if (superAllow) {
            return
        } else {
            return PermissionErrorReason.EXTERNAL
        }
    }

    async hasJoinAndViewPermissionForDocument(document: Document) {
        const actions = [
            PermissionsActions.DOCUMENT_JOIN,
            PermissionsActions.DOCUMENT_VIEW
        ]

        const externalRes = await this.indexApiService.GetPermissionsForDocument(
            actions.join(','),
            document.id,
            this.userId,
            this.teamId,
            this.req.tracing
        )

        if (
            externalRes == null ||
            externalRes.data == null ||
            externalRes.data[document.id] == null
        ) {
            this.reportExternalPermissionError(actions, externalRes)
            return PermissionErrorReason.EXTERNAL
        }

        // external permission
        const [superAllow, superForce] = this.accumulateActions(
            actions,
            externalRes.data[document.id]
        )
        if (superForce) {
            if (superAllow) {
                return
            } else {
                return PermissionErrorReason.EXTERNAL
            }
        }

        // For document joining we dont care about the view permission
        // unless superForce is true.  Since that's already covered in
        // the code above, this code is to just get the join permission.
        const [joinAllow] = this.getExternalPermission(
            PermissionsActions.DOCUMENT_JOIN,
            externalRes.data[document.id]
        )

        // local permission
        const rule = rules[PermissionsActions.DOCUMENT_JOIN]
        return rule(undefined, document.visibility, joinAllow)
    }

    async hasJoinPermissionForDocument(document: Document) {
        const actions = [PermissionsActions.DOCUMENT_JOIN]

        const externalRes = await this.indexApiService.GetPermissionsForDocument(
            actions.join(','),
            document.id,
            this.userId,
            this.teamId,
            this.req.tracing
        )

        if (
            externalRes == null ||
            externalRes.data == null ||
            externalRes.data[document.id] == null
        ) {
            this.reportExternalPermissionError(actions, externalRes)
            return PermissionErrorReason.EXTERNAL
        }

        // external permission
        const [superAllow, superForce] = this.accumulateActions(
            actions,
            externalRes.data[document.id]
        )
        if (superForce) {
            if (superAllow) {
                return
            } else {
                return PermissionErrorReason.EXTERNAL
            }
        }

        // local permission
        const rule = rules[PermissionsActions.DOCUMENT_JOIN]
        return rule(undefined, document.visibility, superAllow)
    }

    async hasPermissionForDocument(
        action: PermissionsActions,
        document: Document
    ) {
        const externalRes = await this.indexApiService.GetPermissionsForDocument(
            action,
            document.id,
            this.userId,
            this.teamId,
            this.req.tracing
        )

        if (
            externalRes == null ||
            externalRes.data == null ||
            externalRes.data[document.id] == null
        ) {
            this.reportExternalPermissionError([action], externalRes)
            return PermissionErrorReason.EXTERNAL
        }

        // external permission
        const [superAllow, superForce] = this.getExternalPermission(
            action,
            externalRes.data[document.id]
        )
        if (superForce) {
            if (superAllow) {
                return
            } else {
                return PermissionErrorReason.EXTERNAL
            }
        }

        // local permission
        const rule = this.getLocalRule(action)
        if (rule != null) {
            const membership = await PermissionsService.hasDocumentMembership({
                userId: this.userId,
                documentId: document.id
            })
            let grant: PERMISSION_TYPES | undefined = undefined
            if (membership != null) {
                grant = membership.permissions
            }

            return rule(grant, document.visibility, superAllow)
        } else if (superAllow) {
            return
        } else {
            return PermissionErrorReason.EXTERNAL
        }
    }

    async canSubmitOperationForDocument(document: Document) {
        const rule = this.getLocalRule(
            PermissionsActions.DOCUMENT_CHANGE
        ) as RuleType
        const membership = await PermissionsService.hasDocumentMembership({
            userId: this.userId,
            documentId: document.id
        })
        let grant: PERMISSION_TYPES | undefined = undefined
        if (membership != null) {
            grant = membership.permissions
        }

        return rule(grant, document.visibility, true)
    }

    private accumulateActions(
        actions: PermissionsActions[],
        external: ActionsPermission
    ) {
        let falseCount = 0
        for (const action of actions) {
            const documentPermission = external[action]
            if (!documentPermission) {
                this.logger.error(
                    `Missing Permission ${action} on user ${this.userId}`
                )
                return [false, false]
            }

            if (documentPermission.force) {
                return [documentPermission.allow, documentPermission.force]
            }

            if (!documentPermission.allow) {
                falseCount++
            }
        }
        return [falseCount === 0, false]
    }

    private getExternalPermission(
        action: PermissionsActions,
        external: ActionsPermission
    ) {
        if (external) {
            const externalPermission = external[action]
            if (externalPermission) {
                return [externalPermission.allow, externalPermission.force]
            }
        }

        return [false, false]
    }

    private getLocalRule(action: PermissionsActions) {
        if (typeof rules[action] === 'function') {
            return rules[action]
        }
        return
    }

    private permissionForAction(
        action: PermissionsActions,
        external: ActionsPermission,
        grant: PERMISSION_TYPES,
        visibility: VISIBILITY_TYPES
    ) {
        const [superAllow, superForce] = this.getExternalPermission(
            action,
            external
        )
        if (superForce) {
            return {
                allow: superAllow,
                force: superForce
            }
        } else {
            const rule = this.getLocalRule(action)
            if (rule != null) {
                const permissionRes = rule(grant, visibility, superAllow)
                return {
                    allow: permissionRes == null,
                    force: false
                }
            } else {
                return {
                    allow: superAllow,
                    force: superForce
                }
            }
        }
    }

    private permissionsForDocumentAndMembership(
        document: Document,
        membership: DocumentMembership,
        actions: PermissionsActions[],
        external: ActionsPermission
    ) {
        let grant: PERMISSION_TYPES
        if (membership != null) {
            grant = membership.permissions
        }

        return actions.reduce((res: ActionsPermission, action) => {
            res[action] = this.permissionForAction(
                action,
                external,
                grant,
                document.visibility
            )
            return res
        }, {})
    }

    private reportExternalPermissionError(
        actions: PermissionsActions[],
        externalRes: any
    ) {
        const actionsString = actions.join(',')
        const errorMessage = `There was no readable permission provided from the external check on ${actionsString}.`
        this.logger.error(errorMessage)
        ErrorCollector.notify(errorMessage, {
            PermissionData: {
                type: PermissionErrorReason.EXTERNAL,
                actions: actionsString,
                userId: this.userId,
                teamId: this.teamId,
                permissions: externalRes
            }
        })
    }
}
