import { Request, Response, NextFunction } from 'express'
import { Statsd } from '../util/Statsd'
import * as opentracing from 'opentracing'

const onHeaders = require('on-headers')

const getUrlString = (url: string) => {
    const route = url.split(/[?#]/)[0]
    return route.replace(/\//g, '_').replace(/^_+|:|_+$/g, '')
}

const addOpenTracing = (parentRoute: string, req: Request, res: Response) => {
    const tracer = opentracing.globalTracer()
    const wireCtx = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers)
    const pathName = `${parentRoute}${req.route.path}`
    const span = tracer.startSpan(pathName, { childOf: wireCtx! })
    span.setTag('http.method', req.method)
    span.setTag('span.kind', 'server')

    span.setTag('request_id', req.headers['request-id'])
    span.setTag('request_source', req.headers['request-source'])
    span.setTag('calling_service', req.headers['calling-service'])
    span.setTag('request_uri', req.route.path)

    // include trace ID in headers so that we can debug slow requests we see in
    // the browser by looking up the trace ID found in response headers
    const responseHeaders = {}
    tracer.inject(span, opentracing.FORMAT_TEXT_MAP, responseHeaders)
    Object.keys(responseHeaders).forEach((key) => {
        return res.setHeader(key, responseHeaders[key])
    })

    // add the span to the request object for handlers to use
    Object.assign(req, { span })
    req.span = span

    // finalize the span when the response is completed
    const finishSpan = function finishSpan() {
        // Route matching often happens after the middleware is run. Try changing the operation name
        // to the route matcher.
        span.setOperationName(pathName)
        span.setTag('http.status_code', res.statusCode)
        if (res.statusCode >= 400) {
            span.setTag('error', true)
            span.setTag('sampling.priority', 1)
        }
        span.finish()
    }
    res.on('close', finishSpan)
    res.on('finish', finishSpan)
}

export default function createMetrics(parentRoute: string) {
    return function metrics(req: Request, res: Response, next: NextFunction) {
        const urlPath = `${parentRoute}${req.route.path}`
        const urlString = getUrlString(urlPath)

        req.invision = Object.assign({}, req.invision, {
            start: +new Date(),
            statsKey: `${req.method}.${urlString}`
        })

        if (req.originalUrl !== '/healthcheck') {
            addOpenTracing(parentRoute, req, res)
        }

        onHeaders(res, () => {
            const now: number = +new Date()
            const duration = now - req.invision!.start!

            const responseType = res.statusCode
                .toString()
                .replace(/\d{2}$/, 'XX')

            const tags = [
                'service:rhombus-api',
                `http-verb:${req.method}`,
                `response-code:${res.statusCode}`,
                `response-type:${responseType}`,
                `request-source:${req.headers['request-source']}`,
                `calling-service:${req.headers['calling-service']}`,
                `url:${req.invision.statsKey!}`
            ]

            Statsd.timing('http.response', duration, tags)
        })

        next()
    }
}
