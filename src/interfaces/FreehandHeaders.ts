import { Request } from 'express'

export interface FreehandHeaders {
    ip: string
    userAgent: string
    hostname: string
}

export const createRequestHeaders = (req: Request) => ({
    ip: req.ip,
    userAgent: req.headers['user-agent'] as string,
    hostname: req.headers['x-forwarded-host'] as string
})
