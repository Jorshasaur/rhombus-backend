import { QueueTask, addUniqueJob } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Logger } from '../../Logger'
import { ReducedRequest } from '../../../interfaces/ReducedRequest'
import { FreehandHeaders } from '../../../interfaces/FreehandHeaders'
import * as DocumentUpdateEmail from '../../../services/DocumentUpdateEmail'
import * as EmailSender from '../../../services/EmailSender'

export const UPDATE_EMAIL_JOB_DELAY = 60 * 60 * 1000 // 1 hour delay
export const UPDATE_EMAIL_JOB_TIMEOUT = 20 * 1000

export interface UpdateEmailQueueData {
    req: ReducedRequest
    documentId: string
    revision: number
    freehandHeaders: FreehandHeaders
    panes?: { [paneId: string]: number }
}

export default async function workerFunc(
    job: Job<UpdateEmailQueueData>
): Promise<string> {
    const emailTemplate = await DocumentUpdateEmail.create(
        job.data.documentId,
        job.data.revision,
        job.data.req,
        job.data.freehandHeaders,
        job.data.panes
    )
    if (emailTemplate != null) {
        await EmailSender.send(emailTemplate, job.data.req)
        return `Update email sent for ${job.data.documentId}`
    }

    return `Update email not sent for ${job.data.documentId} due to template being empty`
}

const task = 'update-email'

export function updateJobData(
    oldData: UpdateEmailQueueData,
    newData: UpdateEmailQueueData
) {
    if (oldData.revision) {
        newData.revision = oldData.revision
    }
    if (newData.panes || oldData.panes) {
        newData.panes = Object.assign(newData.panes || {}, oldData.panes || {})
    }
    return newData
}

export class UpdateEmailQueueTask implements QueueTask {
    public taskName: string = task

    public worker = workerFunc

    public async taskPusher(
        queue: Queue,
        logger: Logger,
        data: UpdateEmailQueueData
    ) {
        logger.debug(
            `QUEUE::Sending update email data for ${data.documentId} to queue`
        )

        return await addUniqueJob(
            queue,
            data,
            task,
            `${task}-${data.documentId}`,
            UPDATE_EMAIL_JOB_DELAY,
            UPDATE_EMAIL_JOB_TIMEOUT,
            updateJobData
        )
    }
}
