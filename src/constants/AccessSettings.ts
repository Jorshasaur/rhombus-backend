export enum PERMISSION_TYPES {
    EDIT,
    COMMENT
}

export enum VISIBILITY_TYPES {
    ALL,
    TEAM,
    INVITE
}

export enum PermissionErrorReason {
    EXTERNAL = 'External',
    DOCUMENT_ACCESS = 'Document_Access',
    DOCUMENT_MEMBERSHIP = 'Document_Membership'
}
