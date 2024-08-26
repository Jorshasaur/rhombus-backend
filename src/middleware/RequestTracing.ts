import { Request, Response, RequestHandler, NextFunction } from 'express'
import { Logger } from '../util/Logger'
import { Config } from '../config'
const logger = Logger

interface LoggingData {
    endpoint: string
    request_id: string
    request_source: string
    calling_service?: string
}

export interface RequestTracing {
    requestId: string
    requestSource: string
    callingService?: string
    outgoingCallingService: string
}

/**
 * Request tracing middleware based on https://invision-engineering.herokuapp.com/requirements/REQ014/index.html
 */
export default function createRequestTracingMiddleware(
    gitSha: string
): RequestHandler {
    return function RequestTracing(
        req: Request,
        res: Response,
        next: NextFunction
    ): void | Response {
        if (req.originalUrl === '/healthcheck') {
            return next()
        }

        if (Config.environment === 'local') {
            logger.info(
                `requestTracing forcing context for GET for ${req.originalUrl} request in developer mode`
            )
            Object.assign(req.headers, {
                'request-id': 'local-testing',
                'request-source': 'developer',
                'calling-service': 'developer'
            })
        }

        const endpoint = req.path
        const requestId = req.headers['request-id'] as string
        let requestSource = req.headers['request-source']
        const callingService = req.headers['calling-service']

        // Domain/Core services need to reject any request that does not have a Request-ID, Request-Source or Calling-Service header.
        if (requestId == null || !requestId.length) {
            return res.status(422).send({
                message: 'Invalid request. There must be a Request-ID header.'
            })
        }

        const loggingData: LoggingData = {
            endpoint,
            request_id: requestId,
            request_source: Config.serviceName
        }

        // We don't use BFF right now so requestSource and callingService is optional for now
        // @todo Request-ID, Request-Source shound be required after we'll have bff
        if (requestSource && requestSource.length) {
            loggingData.request_source = requestSource as string
        }

        if (callingService && callingService.length) {
            loggingData.calling_service = callingService as string
        }

        // if (!requestSource || !requestSource.length) {
        //     return res.status(422).send({
        //       message: 'Invalid request.  There must be a Request-Source header.'
        //     });
        // }

        // if (!callingService || !callingService.length) {
        //     return res.status(422).send({
        //       message: 'Invalid request.  There must be a Calling-Service header.'
        //     });
        // }

        // log the incoming request with the tracing headers
        logger.info('Incoming request received', loggingData)

        // Make tracing headers available to all contexts
        req.tracing = {
            requestId: loggingData.request_id,
            requestSource: loggingData.request_source,
            callingService: loggingData.calling_service,

            // When we make outgoing requests, we use this value in the Calling-Service header
            outgoingCallingService: `${Config.serviceName}/${gitSha}`
        }

        next()
    }
}
