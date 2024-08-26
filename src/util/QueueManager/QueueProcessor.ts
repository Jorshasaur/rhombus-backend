import { Config, isLiveRhombusEnv } from '../../config'
let newrelic: any
if (isLiveRhombusEnv()) {
    newrelic = require('newrelic')
}

import * as Queue from 'bull'
import { Tasks } from '.'
import bugsnag from '../../bugsnag'
import { LaunchDarklyHelper } from '../LaunchDarklyHelper'
import { Logger } from '../Logger'
import SequelizeManager from '../SequelizeManager'
import SocketManager from '../SocketManager'
import { Statsd } from '../Statsd'
import { DocumentSessionQueueTask } from './QueueTasks/DocumentSessionQueueTask'
import { EventBusProducerTask } from './QueueTasks/EventBusProducerTask'
import { FreehandUpdateTask } from './QueueTasks/FreehandUpdateTask'
import { MentionQueueTask } from './QueueTasks/MentionQueueTask'
import { SnapshotQueueTask } from './QueueTasks/SnapshotQueueTask'
import { ThumbnailQueueTask } from './QueueTasks/ThumbnailQueueTask'
import { UpdateEmailQueueTask } from './QueueTasks/UpdateEmailQueueTask'
import { UpdateLastViewedTask } from './QueueTasks/UpdateLastViewedTask'
import { PanesSnapshotTask } from './QueueTasks/PanesSnapshotTask'
import { QueueTask } from './QueueTask'

let logger = Logger

if (!newrelic) {
    logger.debug("Not running New Relic because we aren't in production mode")
}

const MAX_JOB_DURATION = 5 * 60 * 1000
const TWO_WEEKS_IN_MS = 604800000
const ONE_HOUR_IN_MS = 1 * 60 * 60 * 1000

let queue = new Queue(Config.queueName, {
    redis: { port: Config.redis.port, host: Config.redis.host },
    defaultJobOptions: {
        timeout: MAX_JOB_DURATION
    }
})

async function init() {
    bugsnag.start('worker')
    SequelizeManager.getInstance().init()
    SocketManager.getInstance().initWithoutServer()
    if (Config.enableLD) {
        LaunchDarklyHelper.getInstance().connect()
        await LaunchDarklyHelper.getInstance().waitForConnect()
    } else {
        await new Promise((res) => setTimeout(res, 0))
    }

    queue.on('active', (job: any, jobPromise) => {
        logger.debug(`QUEUE::job ${job.id} started`)
    })

    queue.on('failed', (job: any, err) => {
        sendToStats('queue.failed', job)
        bugsnag.notify(err, {
            job: {
                id: job.id
            }
        })
        logger.error(`QUEUE::job ${job.id} errored ${err}`)
    })

    queue.on('completed', (job: any, result) => {
        sendToStats('queue.completed', job)
        job.complete = true
        logger.debug(`QUEUE::job ${job.id} completed - result: ${result}`)
    })

    queue.on('stalled', (job) => {
        logger.debug(`QUEUE::job ${job.id} stalled`)
    })

    queue.on('error', (error) => {
        logger.debug('QUEUE::error:', error)
    })

    _addTasks()

    queue.clean(TWO_WEEKS_IN_MS, 'completed')
    queue.clean(TWO_WEEKS_IN_MS, 'failed')
    queue.clean(ONE_HOUR_IN_MS, 'active')
}

init()

function sendToStats(stat: string, job: any) {
    Statsd.increment(stat, 1, [`job-name:${job.name}`])
}

let tasks: Tasks = {
    SnapshotQueueTask: new SnapshotQueueTask(),
    MentionQueueTask: new MentionQueueTask(),
    UpdateEmailQueueTask: new UpdateEmailQueueTask(),
    ThumbnailQueueTask: new ThumbnailQueueTask(),
    UpdateLastViewed: new UpdateLastViewedTask(),
    DocumentSessionQueueTask: new DocumentSessionQueueTask(),
    EventBusProducerTask: new EventBusProducerTask(),
    FreehandUpdateTask: new FreehandUpdateTask(),
    PanesSnapshotTask: new PanesSnapshotTask()
}

export function close() {
    logger.debug('Closing the bull queue')
    queue.close()
}

function _addTasks() {
    Object.keys(tasks).forEach((key) => {
        let task = tasks[key] as QueueTask

        if (newrelic) {
            queue.process(task.taskName, (job) => {
                logger.debug(
                    `Adding ${task.taskName} transaction tracing in New Relic`
                )
                return newrelic.startBackgroundTransaction(
                    `Bull.${task.taskName}`,
                    async () => {
                        await task.worker(job)
                    }
                )
            })
        } else {
            logger.debug(
                `Skipping tracing for ${task.taskName} because New Relic isnt enabled`
            )
            queue.process(task.taskName, task.worker)
        }
    })
}
