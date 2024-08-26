// https://github.com/InVisionApp/teams-api/blob/9433fd39b579000a62acbc20b4c3fd9127ecf9d6/domain/permission.go
export enum PermissionsActions {
    DOCUMENT_ARCHIVE = 'Document.Archive',
    DOCUMENT_VIEW = 'Document.View',
    DOCUMENT_CREATE = 'Document.Create',
    DOCUMENT_JOIN = 'Document.Join',
    DOCUMENT_CHANGE = 'Document.Change',
    DOCUMENT_COMMENT = 'Document.Comment',
    DOCUMENT_DISCOVER = 'Document.Discover',
    DOCUMENT_PRIVATE_COMMENT = 'Document.PrivateComment',
    DOCUMENT_ADD_MEMBERS = 'Document.AddMembers',
    DOCUMENT_ADD_GUESTS = 'Document.AddGuests',
    DOCUMENT_REMOVE_MEMBERS = 'Document.RemoveMembers',
    DOCUMENT_REMOVE_GUESTS = 'Document.RemoveGuests',
    DOCUMENT_MANAGE_PUBLIC_LINK = 'Document.ManagePublicLink',
    COMMENT_VIEW = 'Comment.View',
    COMMENT_CHANGE = 'Comment.Change',
    COMMENT_RESOLVE = 'Comment.Resolve',
    COMMENT_DELETE = 'Comment.Delete',
    COMMENT_MENTION_DOCUMENT_MEMBER = 'Comment.MentionDocumentMember',
    COMMENT_MENTION_TEAM_MEMBER = 'Comment.MentionTeamMember'
}
