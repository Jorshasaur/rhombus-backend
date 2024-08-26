import { RequestTracing } from '../middleware/RequestTracing'

interface Headers {
    [key: string]: any
}

export function getOutgoingHeaders(
    requestTracing: RequestTracing,
    headers: Headers = {}
): Headers {
    headers['Calling-Service'] = requestTracing.outgoingCallingService
    headers['Request-ID'] = requestTracing.requestId
    headers['Request-Source'] = requestTracing.requestSource
    return headers
}
