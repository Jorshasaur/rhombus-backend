import { Request } from 'express'

interface RequestTracing {
    requestId: string
    requestSource: string
    callingService?: string
    outgoingCallingService: string
}

interface Span {
    setTag: {
        (tagName: string, value: any): void
    }
}

export interface ReducedRequest {
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
    span?: Span | null
    route?: any
}

export function getReducedRequestFromRequest(req: Request): ReducedRequest {
    return {
        invision: req.invision,
        tracing: req.tracing
    }
}
