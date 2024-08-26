import { QueueTask } from './QueueTask'
import { SnapshotQueueTask } from './QueueTasks/SnapshotQueueTask'
import { MentionQueueTask } from './QueueTasks/MentionQueueTask'
import { UpdateEmailQueueTask } from './QueueTasks/UpdateEmailQueueTask'
import { ThumbnailQueueTask } from './QueueTasks/ThumbnailQueueTask'
import { UpdateLastViewedTask } from './QueueTasks/UpdateLastViewedTask'
import { DocumentSessionQueueTask } from './QueueTasks/DocumentSessionQueueTask'
import { EventBusProducerTask } from './QueueTasks/EventBusProducerTask'
import { PanesSnapshotTask } from './QueueTasks/PanesSnapshotTask'
import * as Queue from 'bull'
import { Logger } from '../Logger'
import { Config } from '../../config'
import { Statsd } from '../Statsd'
import { FreehandUpdateTask } from './QueueTasks/FreehandUpdateTask'
import * as Redis from 'ioredis'

const MAX_JOB_DURATION = 5 * 60 * 1000

interface GeneratedTask {
    (data: Object): void
}

export interface Tasks {
    SnapshotQueueTask: SnapshotQueueTask
    ThumbnailQueueTask: ThumbnailQueueTask
    MentionQueueTask: MentionQueueTask
    UpdateEmailQueueTask: UpdateEmailQueueTask
    UpdateLastViewed: UpdateLastViewedTask
    DocumentSessionQueueTask: DocumentSessionQueueTask
    EventBusProducerTask: EventBusProducerTask
    FreehandUpdateTask: FreehandUpdateTask
    PanesSnapshotTask: PanesSnapshotTask
}

function sendToStats(stat: string, job: any) {
    Statsd.increment(stat, 1, [`job-name:${job.name}`])
}

function getTasks(): Tasks {
    return {
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
}

export class QueueTaskPusher {
    public static instance: QueueTaskPusher

    public saveSnapshot: GeneratedTask
    public sendMentionEmail: GeneratedTask
    public sendUpdateEmail: GeneratedTask
    public createNewThumbnail: GeneratedTask
    public startDocumentSession: GeneratedTask
    public updateLastViewed: GeneratedTask
    public emitEventBusEvent: GeneratedTask
    public emitFreehandUpdateToClient: GeneratedTask
    public savePanesSnapshot: GeneratedTask

    private queue: Queue.Queue
    private logger: Logger

    public static getInstance() {
        if (this.instance === null || this.instance === undefined) {
            this.instance = new QueueTaskPusher()
            this.instance._init()
        }
        return this.instance
    }

    // Forces use of getInstance. Can't use 'new' on this class
    private constructor() {}

    private _generateTaskPusher(
        rawTaskPusher: QueueTask['taskPusher']
    ): GeneratedTask {
        return (data: Object) => {
            // @ts-ignore: the type of Queue from @types/bull doesn't match
            // the actual implementation, and this is where that mismatch occurs
            const taskPromise = rawTaskPusher(this.queue, this.logger, data)
            if (taskPromise != null) {
                taskPromise.then((job) => {
                    if (job != null) {
                        sendToStats('queue.added', job)
                    }
                })
            }
        }
    }

    private _addTaskPushers(tasks: Tasks) {
        this.saveSnapshot = this._generateTaskPusher(
            tasks.SnapshotQueueTask.taskPusher
        )
        this.sendMentionEmail = this._generateTaskPusher(
            tasks.MentionQueueTask.taskPusher
        )
        this.sendUpdateEmail = this._generateTaskPusher(
            tasks.UpdateEmailQueueTask.taskPusher
        )
        this.createNewThumbnail = this._generateTaskPusher(
            tasks.ThumbnailQueueTask.taskPusher
        )
        this.updateLastViewed = this._generateTaskPusher(
            tasks.UpdateLastViewed.taskPusher
        )
        this.startDocumentSession = this._generateTaskPusher(
            tasks.DocumentSessionQueueTask.taskPusher
        )
        this.emitEventBusEvent = this._generateTaskPusher(
            tasks.EventBusProducerTask.taskPusher
        )
        this.emitFreehandUpdateToClient = this._generateTaskPusher(
            tasks.FreehandUpdateTask.taskPusher
        )
        this.savePanesSnapshot = this._generateTaskPusher(
            tasks.PanesSnapshotTask.taskPusher
        )
    }

    private _init() {
        this.logger = Logger
        this.logger.debug('QUEUE::Creating queue task pusher')

        // https://github.com/OptimalBits/bull/blob/develop/PATTERNS.md#reusing-redis-connections
        const client = new Redis(Config.redis.port, Config.redis.host)
        const subscriber = new Redis(Config.redis.port, Config.redis.host)

        this.queue = new Queue(Config.queueName, {
            defaultJobOptions: {
                timeout: MAX_JOB_DURATION
            },
            createClient: (type) => {
                switch (type) {
                    case 'client':
                        return client
                    case 'subscriber':
                        return subscriber
                    case 'bclient':
                        return new Redis(Config.redis.port, Config.redis.host)
                    default:
                        throw new Error(`Unexpected connection type: ${type}`)
                }
            }
        })

        this._addTaskPushers(getTasks())
    }
}
