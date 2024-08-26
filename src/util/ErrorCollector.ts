import { isLiveRhombusEnv } from '../config'
export let newrelic: any
if (isLiveRhombusEnv()) {
    newrelic = require('newrelic')
}
import bugsnag from '../bugsnag'

export class ErrorCollector {
    public static notify(
        err: string | Error,
        options?: {
            [key: string]: any
        } /* newrelic has the type: {[key: string]: string;} and BugSnag has it's own typed options.
             I couldn't square them with each other, so we simply don't do typechecking for newrelic */
    ) {
        bugsnag.notify(err, options)
        const isError = options && options.severity === 'error'
        if (newrelic && isError) {
            if (typeof err === 'string') {
                err = new Error(err)
            }
            newrelic.noticeError(err, options)
        }
    }
}
