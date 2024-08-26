import { Api } from '@invisionapp/typed-api-defs'
import {
    TypedRequest,
    TypedResponse
} from '@invisionapp/typed-api-defs/dist/express'
import PagesApi from '@invisionapp/api-type-definitions/src/PagesApi'

export type GetPermissionsRequest = TypedRequest<
    PagesApi['/permissions']['get']['request']
>
export type GetPermissionsResponse = TypedResponse<
    PagesApi['/permissions']['get']['response']
>

export interface PermissionsAPI extends Api {
    '/': PagesApi['/permissions']
}
