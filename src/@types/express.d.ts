import { Permissions } from '../middleware/Permissions'

declare global {
    namespace Express {
        interface RequestTracing {
            requestId: string
            requestSource: string
            callingService?: string
            outgoingCallingService: string
        }

        interface Pagination {
            page: number
            limit: number
            offset: number
        }

        interface Span {
            setTag: {
                (tagName: string, value: any): void
            }
        }

        export interface Request {
            invision: {
                user: {
                    userId: number
                    vendorId: string
                    companyId?: number
                    teamId: string
                    sessionId?: string
                    name: string
                    email: string
                }
                statsKey?: string
                start?: number
            }
            tracing: RequestTracing
            pagination: Pagination
            permissions: Permissions
            span?: Span | null
        }
    }
}
