import { QueueTask, addUniqueJob } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Logger } from '../../Logger'
import DocumentSessionAnalytics from '../../../analytics/AnalyticsBuilders/DocumentSessionAnalytics'

export const SIXTY_MINUTES_IN_SECONDS = 60 * 60
export const SIXTY_MINUTES_IN_MS = SIXTY_MINUTES_IN_SECONDS * 1000

export interface DocumentSessionQueueData {
    documentId: string
    userId: number
    vendorId: string
    teamId: string
    numberOfEdits?: number
    numberOfDeletes?: number
    sessionStart?: Date
}

export default async function workerFunc(job: Job): Promise<string> {
    if (!job.data) {
        throw new Error(`no job data found for ${task} with id ${job.id}`)
    }

    new DocumentSessionAnalytics(
        job.data.vendorId,
        job.data.userId,
        job.data.documentId,
        job.data.teamId
    )
        .numberOfEdits(job.data.numberOfEdits)
        .numberOfDeletes(job.data.numberOfDeletes)
        .sessionStart(job.data.sessionStart)
        .sessionEnd(new Date())
        .sessionTimeoutInSeconds(SIXTY_MINUTES_IN_SECONDS)
        .track()

    return `New document:${job.data.documentId} session recorded for user:${job.data.userId}`
}

const task = 'document-session'

export function updateJobData(oldData: any, newData: any) {
    newData.numberOfEdits += oldData.numberOfEdits
    newData.numberOfDeletes += oldData.numberOfDeletes
    newData.sessionStart = oldData.sessionStart

    return newData
}

export class DocumentSessionQueueTask implements QueueTask {
    public taskName: string = task

    public worker = workerFunc

    public async taskPusher(
        queue: Queue,
        logger: Logger,
        data: DocumentSessionQueueData
    ) {
        logger.debug(
            `QUEUE::Document: ${data.documentId} session QueueTask added for user:${data.userId}`
        )

        let jobId: string = [task, data.documentId, data.userId].join(':')

        data.numberOfEdits = data.numberOfEdits || 0
        data.numberOfDeletes = data.numberOfDeletes || 0
        data.sessionStart = data.sessionStart || new Date()

        return await addUniqueJob(
            queue,
            data,
            task,
            jobId,
            SIXTY_MINUTES_IN_MS,
            undefined,
            updateJobData
        )
    }
}
