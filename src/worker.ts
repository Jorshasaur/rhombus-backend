import { isLiveRhombusEnv } from './config'
let newrelic: any
if (isLiveRhombusEnv()) {
    newrelic = require('newrelic')
}
import * as forever from 'forever-monitor'
import bugsnagWrapper from './bugsnag'
import { ErrorCollector } from './util/ErrorCollector'
import { Logger } from './util/Logger'
import * as QueueProcessor from './util/QueueManager/QueueProcessor'
import { WorkerServer } from './workerServer'

const logger = Logger

if (!newrelic) {
    logger.debug("Not running New Relic because we aren't in production mode")
}

if (!process.env.PAGES_WORKER) {
    logger.error('PAGES_WORKER variable must be defined')
}

let server: WorkerServer
let ebConsumer: forever.Monitor

const init = () => {
    logger.debug('Starting Up Worker Server')
    server! = new WorkerServer()

    ebConsumer = new forever.Monitor(
        './src/event-bus/consumer/ConsumerRunner.ts',
        {
            command: 'node --require ts-node/register/transpile-only',
            silent: false
        }
    )

    ebConsumer.on('exit', function() {
        logger.fatal('event bus consumer has exited')
        bugsnagWrapper.notify('Event Bus Consumer has exited.')
        setTimeout(() => {
            process.exit(1)
        }, 100)
    })

    ebConsumer.start()
}

process.on('uncaughtException', (err) => {
    logger.fatal({ err: err }, 'Uncaught Exception')
    bugsnagWrapper.notify(err, {
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
    if (QueueProcessor) {
        QueueProcessor.close()
    }
    if (ebConsumer) {
        ebConsumer.stop()
    }
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)

init()
