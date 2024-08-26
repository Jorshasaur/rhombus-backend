import { QueueTask } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Document } from '../../../models/Document'
import { Logger } from '../../Logger'
import * as eventBusProducer from '../../../event-bus/producer/events'
import PermissionsService from '../../../services/permissions/Service'

export interface UpdateLastViewedData {
    documentId: string
    userId: string
}

export default async function workerFunc(job: Job) {
    const logger = Logger
    logger.debug(
        'Updating lastViewed date::Connecting to sequelize in progress'
    )
    if (!job.data || !job.data.documentId || !job.data.userId) {
        throw new Error('Missing data from the UpdateLastViewed job')
    }

    const document = await Document.findById(job.data.documentId)
    if (!document) {
        throw new Error(
            `Unable to update last viewed, document ${job.data.documentId} can't be found`
        )
    }

    const membership = await PermissionsService.hasDocumentMembership({
        userId: job.data.userId,
        documentId: job.data.documentId
    })

    if (!membership) {
        throw new Error(
            `Unable to update last viewed, document member ${job.data.userId} for document ${job.data.documentId} can't be found`
        )
    }

    membership.lastViewed = new Date()
    await membership.save()

    eventBusProducer.documentViewed(
        document.teamId,
        job.data.userId,
        job.data.documentId
    )

    logger.debug(
        `UpdateLastViewed job complete for membership ${membership!.id}`
    )

    return `lastViewed updated for membership ${membership!.id}`
}

const task = 'updatelastviewed'

export class UpdateLastViewedTask implements QueueTask {
    public taskName: string = task

    public worker = workerFunc

    public taskPusher(
        queue: Queue,
        logger: Logger,
        data: UpdateLastViewedData
    ) {
        logger.debug(
            `QUEUE::Adding ${data.documentId} to queue for updating the last viewed date.`
        )
        return queue.add(task, data)
    }
}
