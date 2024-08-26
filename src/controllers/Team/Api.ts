import { Api } from '@invisionapp/typed-api-defs'
import {
    TypedRequest,
    TypedResponse
} from '@invisionapp/typed-api-defs/dist/express'
import PagesApi from '@invisionapp/api-type-definitions/src/PagesApi'

export interface TeamApi extends Api {
    '/:teamId/documents': PagesApi['/teams/{teamId}/documents']
    '/:teamId/users/:userId/documents': PagesApi['/teams/{teamId}/users/{userId}/documents']
}

export type GetTeamDocumentsRequest = TypedRequest<
    PagesApi['/teams/{teamId}/documents']['get']['request']
>
export type GetTeamDocumentsResponse = TypedResponse<
    PagesApi['/teams/{teamId}/documents']['get']['response']
>

export type GetUserDocumentsRequest = TypedRequest<
    PagesApi['/teams/{teamId}/users/{userId}/documents']['get']['request']
>
export type GetUserDocumentsResponse = TypedResponse<
    PagesApi['/teams/{teamId}/users/{userId}/documents']['get']['response']
>
