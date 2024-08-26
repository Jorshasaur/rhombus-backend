import {
    TypedResponse,
    TypedRequest
} from '@invisionapp/typed-api-defs/dist/express'

interface PaneResponse {}

interface PanesResponse {}

interface PaneGetRevisionsSinceRevisionResponse {}

interface PagesApi {
    '/panes': {
        get: {
            request: {
                query: {
                    team_id: string
                    user_id: number
                    documentId: string
                }
            }
            response: PanesResponse
        }
        post: {
            request: {
                query: {
                    team_id: string
                    user_id: number
                }
                body: {
                    title: string
                    documentId: string
                }
            }
            response: PaneResponse
        }
    }
    '/panes/{paneId}': {
        get: {
            request: {
                query: {
                    team_id: string
                    user_id: number
                    documentId: string
                }
                params: {
                    paneId: string
                }
            }
            response: PaneResponse
        }
    }
    '/panes/{paneId}/duplicate': {
        post: {
            request: {
                body: {
                    documentId: string
                }
                params: {
                    paneId: string
                }
            }
            response: PaneResponse
        }
    }
    '/{paneId}/revisionsSinceRevision/{revision}': {
        get: {
            request: {
                query: {
                    team_id: string
                    user_id: number
                    documentId: string
                }
                params: {
                    paneId: string
                    revision: number
                }
            }
            response: PaneGetRevisionsSinceRevisionResponse
        }
    }
}

export type CreatePaneRequest = TypedRequest<
    PagesApi['/panes']['post']['request']
>
export type CreatePaneResponse = TypedResponse<
    PagesApi['/panes']['post']['response']
>
export type DuplicatePaneRequest = TypedRequest<
    PagesApi['/panes/{paneId}/duplicate']['post']['request']
>
export type DuplicatePaneResponse = TypedResponse<
    PagesApi['/panes/{paneId}/duplicate']['post']['response']
>

export type GetPanesRequest = TypedRequest<PagesApi['/panes']['get']['request']>
export type GetPanesResponse = TypedResponse<
    PagesApi['/panes']['get']['response']
>

export type GetPaneRequest = TypedRequest<
    PagesApi['/panes/{paneId}']['get']['request']
>
export type GetPaneResponse = TypedResponse<
    PagesApi['/panes/{paneId}']['get']['response']
>

export type GetRevisionsSinceRevisionRequest = TypedRequest<
    PagesApi['/{paneId}/revisionsSinceRevision/{revision}']['get']['request']
>
export type GetRevisionsSinceRevisionResponse = TypedResponse<
    PagesApi['/{paneId}/revisionsSinceRevision/{revision}']['get']['response']
>
