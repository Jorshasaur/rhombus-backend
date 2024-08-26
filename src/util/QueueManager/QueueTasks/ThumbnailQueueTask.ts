import { QueueTask, addUniqueJob } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Logger } from '../../Logger'
import { createThumbnail } from '../../../services/ThumbnailerService'
import { ReducedRequest } from '../../../interfaces/ReducedRequest'
import { FreehandHeaders } from '../../../interfaces/FreehandHeaders'
import { Document } from '../../../models/Document'
import * as eventBusProducer from '../../../event-bus/producer/events'
import { THIRTY_SECONDS_IN_MS } from '../../../constants/Integers'

export const THUMBNAIL_JOB_TIMEOUT = 15 * 1000

export interface ThumbnailQueueData {
    req: ReducedRequest
    documentId: string
    freehandHeaders: FreehandHeaders
}

export default async function workerFunc(job: Job): Promise<string> {
    const document = await Document.findOne({
        where: { id: job.data.documentId }
    })
    if (document == null) {
        throw new Error(
            `Unable to create thumbnail, document ${job.data.documentId} can't be found`
        )
    }
    const thumbnailAssetKey = (await createThumbnail(
        document,
        job.data.req,
        job.data.freehandHeaders
    )) as string
    document!.thumbnailAssetKey = thumbnailAssetKey
    await document!.save()

    eventBusProducer.documentThumbnailUpdated(document.teamId, document.id)

    return `Thumbnail created for ${job.data.documentId}`
}

const task = 'thumbnail'

export class ThumbnailQueueTask implements QueueTask {
    public taskName: string = task

    public worker = workerFunc

    public async taskPusher(
        queue: Queue,
        logger: Logger,
        data: ThumbnailQueueData
    ) {
        logger.debug(
            `QUEUE::Adding thumbnail creation for ${data.documentId} to queue`
        )
        return await addUniqueJob(
            queue,
            data,
            task,
            `${task}-${data.documentId}`,
            THIRTY_SECONDS_IN_MS,
            THUMBNAIL_JOB_TIMEOUT
        )
    }
}
