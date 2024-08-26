import { QueueTask, addUniqueJob } from '../QueueTask'
import { Job } from 'bull'
import { Logger } from '../../Logger'
import { emit } from '../../../event-bus/producer'
import { Queue } from '../queueClient'

export interface EventBusProducerData {
    type: string
    eventData: any
    debounce: number
}

export default async function workerFunc(job: Job) {
    if (!job.data || !job.data.type) {
        throw new Error('Missing data from the event bus producer job')
    }

    await emit(job.data.type, job.data.eventData)

    return `Event-bus '${job.data.type}' event sent`
}

const task = 'event-bus-producer'

export class EventBusProducerTask implements QueueTask {
    public taskName = task

    public worker = workerFunc

    public async taskPusher(
        queue: Queue,
        logger: Logger,
        data: EventBusProducerData
    ) {
        logger.debug(
            `QUEUE::Adding ${data.type} to queue for event bus producer.`
        )
        if (data.debounce) {
            return await addUniqueJob(
                queue,
                data,
                task,
                `${task}-${data.eventData.documentId}`,
                data.debounce
            )
        }
        return queue.add(task, data)
    }
}
