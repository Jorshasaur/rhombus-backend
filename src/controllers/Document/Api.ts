import PagesApi from '@invisionapp/api-type-definitions/src/PagesApi'
import { Api, Request } from '@invisionapp/typed-api-defs'
import {
    TypedRequest,
    TypedResponse
} from '@invisionapp/typed-api-defs/dist/express'
import { Document } from '../../models/Document'

export type NewDocumentRequest = TypedRequest<
    PagesApi['/documents/new']['post']['request']
>
export type NewDocumentResponse = TypedResponse<
    PagesApi['/documents/new']['post']['response']
>

export type GetDocumentRequest = TypedRequest<
    PagesApi['/documents/{documentId}']['get']['request']
>
export type GetDocumentResponse = TypedResponse<
    PagesApi['/documents/{documentId}']['get']['response']
>

export type GetDocumentAtRevisionRequest = TypedRequest<
    PagesApi['/documents/{documentId}/revision/{revision}']['get']['request']
>
export type GetDocumentAtRevisionResponse = TypedResponse<
    PagesApi['/documents/{documentId}/revision/{revision}']['get']['response']
>

export type ArchiveDocumentRequest = TypedRequest<
    PagesApi['/documents/{documentId}/archive']['post']['request']
>
export type ArchiveDocumentResponse = TypedResponse<
    PagesApi['/documents/{documentId}/archive']['post']['response']
>

export type UnarchiveDocumentRequest = TypedRequest<
    PagesApi['/documents/{documentId}/unarchive']['post']['request']
>
export type UnarchiveDocumentResponse = TypedResponse<
    PagesApi['/documents/{documentId}/unarchive']['post']['response']
>

export type GetMembershipsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/memberships']['get']['request']
>
export type GetMembershipsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/memberships']['get']['response']
>

export type AddMembersToMembershipsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/memberships/add']['post']['request']
>
export type AddMembersToMembershipsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/memberships/add']['post']['response']
>

export type UpdateMembershipsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/memberships/{memberId}']['post']['request']
>
export type UpdateMembershipsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/memberships/{memberId}']['post']['response']
>

export type RemoveFromMembershipsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/memberships/{memberId}']['delete']['request']
>
export type RemoveFromMembershipsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/memberships/{memberId}']['delete']['response']
>

export type GetAccessSettingsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/access-settings']['get']['request']
>
export type GetAccessSettingsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/access-settings']['get']['response']
>

export type SetAccessSettingsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/access-settings']['post']['request']
>
export type SetAccessSettingsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/access-settings']['post']['response']
>

export type ListDocumentsRequest = TypedRequest<
    DocumentsAPI['/']['get']['request']
>
export type ListDocumentsResponse = TypedResponse<
    DocumentsAPI['/']['get']['response']
>

export type GetPermissionsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/permissions']['get']['request']
>
export type GetPermissionsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/permissions']['get']['response']
>

export type GetPermissionsForDocumentsRequest = TypedRequest<
    PagesApi['/documents/permissions']['get']['request']
>
export type GetPermissionsForDocumentsResponse = TypedResponse<
    PagesApi['/documents/permissions']['get']['response']
>

export type GetDocumentThumbnailRequest = TypedRequest<
    PagesApi['/documents/{documentId}/thumbnail']['get']['request']
>
export type GetDocumentThumbnailResponse = TypedResponse<
    PagesApi['/documents/{documentId}/thumbnail']['get']['response']
>

export type GetDocumentTextRequest = TypedRequest<
    PagesApi['/documents/{documentId}/text']['get']['request']
>
export type GetDocumentTextResponse = TypedResponse<
    PagesApi['/documents/{documentId}/text']['get']['response']
>

export type SubscribeToDocumentRequest = TypedRequest<
    PagesApi['/documents/{documentId}/subscribe']['post']['request']
>
export type SubscribeToDocumentResponse = TypedResponse<
    PagesApi['/documents/{documentId}/subscribe']['post']['response']
>

export type UnsubscribeFromDocumentRequest = TypedRequest<
    PagesApi['/documents/{documentId}/unsubscribe']['post']['request']
>
export type UnsubscribeFromDocumentResponse = TypedResponse<
    PagesApi['/documents/{documentId}/unsubscribe']['post']['response']
>

export type GetDocumentRevisionsRequest = TypedRequest<
    PagesApi['/documents/{documentId}/revisions']['get']['request']
>
export type GetDocumentRevisionsResponse = TypedResponse<
    PagesApi['/documents/{documentId}/revisions']['get']['response']
>

export type GetDocumentRevisionRequest = TypedRequest<
    PagesApi['/documents/{documentId}/revisions/{revision}']['get']['request']
>
export type GetDocumentRevisionResponse = TypedResponse<
    PagesApi['/documents/{documentId}/revisions/{revision}']['get']['response']
>

export interface DocumentsAPI extends Api {
    '/': {
        get: {
            request: Request
            response: {
                documents: Document[]
            }
        }
    }
    '/new': PagesApi['/documents/new']
    '/:documentId': PagesApi['/documents/{documentId}']
    '/documents/:documentId': PagesApi['/private/documents/{documentId}']
    '/:documentId/archive': PagesApi['/documents/{documentId}/archive']
    '/:documentId/unarchive': PagesApi['/documents/{documentId}/unarchive']
    '/:documentId/subscribe': PagesApi['/documents/{documentId}/subscribe']
    '/:documentId/unsubscribe': PagesApi['/documents/{documentId}/unsubscribe']
    '/:documentId/thumbnail': PagesApi['/documents/{documentId}/thumbnail']
    '/:documentId/memberships': PagesApi['/documents/{documentId}/memberships']
    '/:documentId/memberships/add': PagesApi['/documents/{documentId}/memberships/add']
    '/:documentId/memberships/:memberId': PagesApi['/documents/{documentId}/memberships/{memberId}']
    '/:documentId/access-settings': PagesApi['/documents/{documentId}/access-settings']
    '/:documentId/permissions': PagesApi['/documents/{documentId}/permissions']
    '/:documentId/text': PagesApi['/documents/{documentId}/text']
    '/permissions': PagesApi['/documents/permissions']
    '/:documentId/revisions': PagesApi['/documents/{documentId}/revisions']
    '/:documentId/revisions/:revision': PagesApi['/documents/{documentId}/revisions/{revision}']
}
