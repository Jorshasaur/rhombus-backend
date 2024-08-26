import Bugsnag, { Config as BugsnagConfig } from '@bugsnag/js'
import { Config } from './config'
import { Logger } from './util/Logger'
import { long as gitLong } from 'git-rev-sync'
import { cloneDeep, omit } from 'lodash'

const logger = Logger

const reportingEnabled = Config.nodeEnv !== 'test'
const muted = ['Loaded!', 'Report not sent due to beforeSend callback']

// bugsnag's default logger automatically prefixes its output with '[bugsnag] '. Unfortunately, you
// have to do this manually when you tell it to use a different logger, or else you get perplexing,
// no-context debug output like "Loaded!".
const prefix = (methodName: string) => (
    msg: string,
    ...moreArgs: any[]
): void => {
    if (reportingEnabled || !muted.includes(msg)) {
        logger[methodName](`[bugsnag] ${msg}`, ...moreArgs)
    }
}

const prefixedLogger = {
    debug: prefix('debug'),
    error: prefix('error'),
    info: prefix('info'),
    warn: prefix('warn')
}
export default {
    notify(error: string | Error, options: { [key: string]: any } = {}) {
        let snagOptions = cloneDeep(omit(options, ['context', 'severity']))
        const invision = snagOptions?.req?.invision
        if (Config.bugsnagEnabled) {
            Bugsnag.notify(error, (event) => {
                if (options?.severity) {
                    event.severity = options.severity
                }
                if (options?.context) {
                    event.context = options.context
                }
                Object.entries(snagOptions).forEach(([k, v]) => {
                    event.addMetadata(k, v)
                })
                if (invision?.user?.userId != null) {
                    event.setUser(invision.user.userId)
                }
                event.errors.forEach((err) => {
                    err.stacktrace = err.stacktrace.map((frame) => {
                        return {
                            ...frame,
                            inProject:
                                (frame.file.startsWith('build/') ||
                                    frame.file.startsWith('src/')) &&
                                !shouldIgnoreFile(frame.file)
                        }
                    })
                })
            })
        } else {
            if (!snagOptions) {
                snagOptions = {}
            }
            logger.error('BUGSNAG: ', snagOptions, error)
        }
    },

    start(appType: 'worker' | 'server', opts?: Partial<BugsnagConfig>) {
        if (Config.bugsnagEnabled) {
            logger.debug(`Registering Bugsnag from ${appType}`)
            Bugsnag.start({
                apiKey: Config.bugsnagKey,
                appVersion: gitLong(),
                appType,
                logger: prefixedLogger,
                releaseStage: Config.metadataType,
                // Clearing out these values to protect PI from going into BS
                redactedKeys: [/name/, /email/],
                metadata: { cluster: Config.metadataName },
                onError: (event) => {
                    event.errors.forEach((err) => {
                        err.stacktrace = err.stacktrace.map((frame) => {
                            return {
                                ...frame,
                                inProject:
                                    frame.file.includes('src/') &&
                                    !shouldIgnoreFile(frame.file)
                            }
                        })
                    })
                },
                ...opts
            })
        }
    }
}

function shouldIgnoreFile(file: string) {
    return (
        file.includes('bugsnag') ||
        file.includes('services/DomainService') ||
        file.includes('util/ErrorCollector') ||
        file.includes('node_modules')
    )
}
