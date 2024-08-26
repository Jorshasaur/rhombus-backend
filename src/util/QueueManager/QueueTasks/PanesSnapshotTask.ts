import { QueueTask } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Pane } from '../../../models/Pane'
import { Logger } from '../../Logger'

export interface PanesSnapshotData {
    paneId: string
    teamId: string
}

export default async function workerFunc(job: Job) {
    const logger = Logger
    logger.debug('PANES SNAPSHOT::Connecting to sequelize in progress')

    if (!job.data || !job.data.paneId || !job.data.teamId) {
        throw new Error('Missing data from the snapshot job')
    }

    const pane = await Pane.findOne({
        where: { id: job.data.paneId, teamId: job.data.teamId }
    })
    if (!pane) {
        throw new Error(
            `Unable to make a snapshot, pane ${job.data.paneId} can't be found`
        )
    }

    await pane!.saveSnapshot()

    logger.debug(`PANE SNAPSHOT::Snapshot complete for ${pane!.id}`)

    return `Pane Snapshot saved for ${pane!.id}`
}

const task = 'panesSnapshot'

export class PanesSnapshotTask implements QueueTask {
    public taskName: string = task

    public worker = workerFunc

    public taskPusher(queue: Queue, logger: Logger, data: PanesSnapshotData) {
        logger.debug(
            `QUEUE::Adding ${data.paneId} to queue for panes snapshotting.`
        )
        return queue.add(task, data)
    }
}
