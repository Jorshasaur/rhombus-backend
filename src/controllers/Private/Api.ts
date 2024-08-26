import { Api } from '@invisionapp/typed-api-defs'
import {
    TypedRequest,
    TypedResponse
} from '@invisionapp/typed-api-defs/dist/express'
import PagesApi from '@invisionapp/api-type-definitions/src/PagesApi'

export type GetDocumentAsGuestRequest = TypedRequest<
    PagesApi['/private/documents/{documentId}']['get']['request']
>
export type GetDocumentAsGuestResponse = TypedResponse<
    PagesApi['/private/documents/{documentId}']['get']['response']
>

export type GetTeamDocumentsPrivateRequest = TypedRequest<
    PagesApi['/private/teams/{teamId}/documents']['get']['request']
>
export type GetTeamDocumentsPrivateResponse = TypedResponse<
    PagesApi['/private/teams/{teamId}/documents']['get']['response']
>

export type EmitGenericEventRequest = TypedRequest<
    PagesApi['/private/documents/{documentId}/emit-event']['post']['request']
>
export type EmitGenericEventResponse = TypedResponse<
    PagesApi['/private/documents/{documentId}/emit-event']['post']['response']
>

export interface PrivateAPI extends Api {
    '/documents/:documentId': PagesApi['/private/documents/{documentId}']
    '/teams/:teamId/documents': PagesApi['/private/teams/{teamId}/documents']
    '/documents/:documentId/emit-event': PagesApi['/private/documents/{documentId}/emit-event']
}
