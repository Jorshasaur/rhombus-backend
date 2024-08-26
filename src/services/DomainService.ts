import { ReducedRequest } from '../interfaces/ReducedRequest'
import * as opentracing from 'opentracing'
import Axios, { AxiosInstance } from '@invisionapp/typed-api-defs/dist/axios'
import { AxiosInstance as NativeAxiosInstance } from 'axios'
import axiosRetry from 'axios-retry/lib'
import { Logger } from '../util/Logger'
import { THIRTY_SECONDS_IN_MS } from '../constants/Integers'
import { AxiosError } from 'axios'
import { ErrorCollector } from '../util/ErrorCollector'

export default class DomainService {
    private _request: ReducedRequest
    span: opentracing.Span
    axios: AxiosInstance
    currentFunctionName: string
    logger: Logger
    serviceName: string = 'DomainService'

    constructor(req?: ReducedRequest) {
        this.logger = Logger
        this.axios = Axios.create({ timeout: THIRTY_SECONDS_IN_MS })
        axiosRetry(this.axios as NativeAxiosInstance, {
            retries: 3,
            retryDelay: axiosRetry.exponentialDelay
        })
        if (req) {
            this.request = req
        }
    }

    set request(req: ReducedRequest) {
        this._request = req
        this.addInterceptors()
    }

    get request() {
        return this._request
    }

    private addInterceptors() {
        this.axios.interceptors.request.use(
            (config) => {
                const opts = {
                    childOf: this.request.span!,
                    tags: {
                        service: `${this.constructor.name}`
                    }
                }
                const name = `${this.constructor.name}.${this.currentFunctionName}`
                this.span = opentracing.globalTracer().startSpan(name, opts)
                this.span.setTag('span.kind', 'service-to-service')
                this.span.setTag('request_id', this.request.tracing.requestId)
                this.span.setTag(
                    'request_source',
                    this.request.tracing.requestSource
                )
                this.span.setTag(
                    'calling_service',
                    this.request.tracing.callingService
                )
                this.span.setTag('request_uri', this.request.route.path)
                return config
            },
            (err) => {
                this.span.setTag('error', true)
                this.span.finish()
                throw err
            }
        )
        this.axios.interceptors.response.use(
            (response) => {
                this.span.setTag('http.status_code', response.status)
                this.span.finish()
                return response
            },
            (err) => {
                this.span.setTag(
                    'http.status_code',
                    err.response ? err.response.status : '500'
                )
                this.span.setTag('error', true)
                this.span.finish()
                throw err
            }
        )
    }

    track(name: string) {
        if (this._request) {
            this.currentFunctionName = name
        } else {
            this.logger.error(
                `A request object is needed in order to trace this request - ${name}`
            )
        }
    }

    logError(error: AxiosError) {
        const errorMessage =
            error.response && error.response.data
                ? JSON.stringify(error.response.data)
                : error
        const errorString =
            `Error response from ${this.serviceName}: ` +
            errorMessage +
            'Failure url: ' +
            error.config.url +
            'Failure params: ' +
            error.config.params
        this.logger.error(errorString)
        ErrorCollector.notify(errorString)
    }
}
