import { PermissionsActions } from './Actions'
import {
    VISIBILITY_TYPES,
    PERMISSION_TYPES,
    PermissionErrorReason
} from '../../constants/AccessSettings'

export type RuleType = (
    grant: PERMISSION_TYPES | undefined,
    visibility: VISIBILITY_TYPES,
    superAllow: boolean
) => PermissionErrorReason | undefined
interface Rules {
    [action: string]: RuleType
}

const rules: Rules = {
    [PermissionsActions.DOCUMENT_JOIN]: (
        grant: PERMISSION_TYPES | undefined,
        visibility: VISIBILITY_TYPES,
        superAllow: boolean
    ) => {
        if (visibility === VISIBILITY_TYPES.TEAM && superAllow) {
            return
        }
        if (visibility === VISIBILITY_TYPES.ALL) {
            return
        }
        if (visibility === VISIBILITY_TYPES.INVITE) {
            return PermissionErrorReason.DOCUMENT_MEMBERSHIP
        }

        return PermissionErrorReason.DOCUMENT_ACCESS
    },

    [PermissionsActions.DOCUMENT_VIEW]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_ADD_MEMBERS]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_REMOVE_MEMBERS]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (grant === PERMISSION_TYPES.EDIT) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_ADD_GUESTS]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (grant === PERMISSION_TYPES.EDIT) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_ARCHIVE]: (
        grant: PERMISSION_TYPES | undefined,
        visibility: VISIBILITY_TYPES,
        superAllow: boolean
    ) => {
        if (grant === PERMISSION_TYPES.EDIT && superAllow) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_CHANGE]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (grant === PERMISSION_TYPES.EDIT) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_COMMENT]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_COMMENT]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_DISCOVER]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.DOCUMENT_MANAGE_PUBLIC_LINK]: (
        grant: PERMISSION_TYPES | undefined,
        visibility: VISIBILITY_TYPES,
        superAllow: boolean
    ) => {
        if (grant === PERMISSION_TYPES.EDIT && superAllow) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.COMMENT_DELETE]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.COMMENT_RESOLVE]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.COMMENT_CHANGE]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.COMMENT_MENTION_DOCUMENT_MEMBER]: (
        grant: PERMISSION_TYPES | undefined,
        visibility: VISIBILITY_TYPES,
        superAllow: boolean
    ) => {
        if (
            (grant === PERMISSION_TYPES.EDIT ||
                grant === PERMISSION_TYPES.COMMENT) &&
            superAllow
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    },

    [PermissionsActions.COMMENT_MENTION_TEAM_MEMBER]: (
        grant: PERMISSION_TYPES | undefined
    ) => {
        if (
            grant === PERMISSION_TYPES.EDIT ||
            grant === PERMISSION_TYPES.COMMENT
        ) {
            return
        }
        return PermissionErrorReason.DOCUMENT_MEMBERSHIP
    }
}

export default rules
