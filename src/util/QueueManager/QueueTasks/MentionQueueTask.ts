import { QueueTask } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Logger } from '../../Logger'
import { ReducedRequest } from '../../../interfaces/ReducedRequest'
import { FreehandHeaders } from '../../../interfaces/FreehandHeaders'
import * as MentionEmail from '../../../services/MentionEmail'
import * as EmailSender from '../../../services/EmailSender'

export const FIVE_MINUTES_IN_MS = 5 * 60 * 1000

export interface MentionQueueData {
    req: ReducedRequest
    documentId: string
    paneId?: string
    revision: number
    freehandHeaders: FreehandHeaders
}

export default async function workerFunc(
    job: Job<MentionQueueData>
): Promise<string> {
    const { documentId, paneId, revision, req, freehandHeaders } = job.data

    const emailTemplate = await MentionEmail.create(
        documentId,
        paneId,
        revision,
        req,
        freehandHeaders
    )
    if (emailTemplate != null) {
        await EmailSender.send(emailTemplate, job.data.req)

        if (paneId) {
            return `Mention email sent for pane(${paneId})`
        }

        return `Mention email sent for document(${documentId})`
    }

    return `Mention email not sent for ${job.data.documentId} due to template being empty`
}

const task = 'mention'

export class MentionQueueTask implements QueueTask {
    public taskName: string = task

    public worker = workerFunc

    public taskPusher(queue: Queue, logger: Logger, data: MentionQueueData) {
        logger.debug(
            `QUEUE::Sending mention data for ${data.documentId} to queue`
        )
        return queue.add(task, data, {
            delay: FIVE_MINUTES_IN_MS
        })
    }
}
