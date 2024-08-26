import { QueueTask } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Document } from '../../../models/Document'
import { Logger } from '../../Logger'

export interface SnapshotQueueData {
    documentId: string
}

export default async function workerFunc(job: Job) {
    const logger = Logger
    logger.debug('SNAPSHOT::Connecting to sequelize in progress')

    if (!job.data || !job.data.documentId) {
        throw new Error('Missing data from the snapshot job')
    }

    const document = await Document.findOne({
        where: { id: job.data.documentId }
    })
    if (!document) {
        throw new Error(
            `Unable to make a snapshot, document ${job.data.documentId} can't be found`
        )
    }

    await document!.saveSnapshot()

    logger.debug(`SNAPSHOT::Snapshot complete for ${document!.id}`)

    return `Snapshot saved for ${document!.id}`
}

const task = 'snapshot'

export class SnapshotQueueTask implements QueueTask {
    public taskName: string = task

    public worker = workerFunc

    public taskPusher(queue: Queue, logger: Logger, data: SnapshotQueueData) {
        logger.debug(
            `QUEUE::Adding ${data.documentId} to queue for snapshotting.`
        )
        return queue.add(task, data)
    }
}
