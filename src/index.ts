import { Config, isLiveRhombusEnv } from './config'
let newrelic: any
if (isLiveRhombusEnv()) {
    newrelic = require('newrelic')
}

import { Logger } from './util/Logger'
import { Server } from './server'
import Bugsnag from './bugsnag'
import BugsnagPluginExpress from '@bugsnag/plugin-express'
import { ErrorCollector } from './util/ErrorCollector'

const logger = Logger

if (!newrelic) {
    logger.debug("Not running New Relic because we aren't in production mode")
}

let server: Server

const init = () => {
    if (Config.bugsnagEnabled) {
        Bugsnag.start('server', { plugins: [BugsnagPluginExpress] })
    }

    logger.debug('Starting Up Server')
    server! = new Server()
}

process.on('uncaughtException', (err) => {
    logger.fatal('Uncaught Exception', { err: err })
    Bugsnag.notify(err, {
        context: 'uncaughtException',
        severity: 'error'
    })
    setTimeout(() => {
        if (newrelic) {
            newrelic.shutdown({ collectPendingData: true }, function() {
                process.exit(1)
            })
        } else {
            process.exit(1)
        }
    }, 100)
})

process.on('unhandledRejection', (error: any, promise) => {
    logger.fatal({ err: error }, 'Unhandled Rejection')
    ErrorCollector.notify(error, {
        context: 'Unhandled Rejection',
        severity: 'error'
    })
    setTimeout(() => {
        if (newrelic) {
            newrelic.shutdown({ collectPendingData: true }, function() {
                process.exit(1)
            })
        } else {
            process.exit(1)
        }
    }, 100)
})

const shutdown = () => {
    if (server) {
        server.gracefulShutdown()
    }
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)

init()
