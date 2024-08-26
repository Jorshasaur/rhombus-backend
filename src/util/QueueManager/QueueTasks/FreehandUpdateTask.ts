import { QueueTask, addUniqueJob } from '../QueueTask'
import { Job } from 'bull'
import { Queue } from '../queueClient'
import { Logger } from '../../Logger'
import { IFindOptions, Sequelize } from 'sequelize-typescript'
import { DocumentRevision } from '../../../models/DocumentRevision'
import { property } from 'lodash'
import SocketManager from '../../SocketManager'

export interface FreehandUpdateData {
    freehandDocumentId: number
    debounce: number
}

export default async function workerFunc(job: Job) {
    await onFreehandSignificantlyChanged(job.data.freehandDocumentId)

    return 'Freehand update event sent'
}

const task = 'freehand-update'

export class FreehandUpdateTask implements QueueTask {
    public taskName = task

    public worker = workerFunc

    public async taskPusher(
        queue: Queue,
        logger: Logger,
        data: FreehandUpdateData
    ) {
        logger.debug('QUEUE::Adding freehand update task to queue.')
        if (data.debounce) {
            return await addUniqueJob(
                queue,
                data,
                task,
                `${task}-${data.freehandDocumentId}`,
                data.debounce
            )
        }
        return queue.add(task, data)
    }
}

export async function onFreehandSignificantlyChanged(
    freehandDocumentId: number
) {
    // TODO: index this query
    const query: IFindOptions<DocumentRevision> = {
        where: {
            delta: {
                [Sequelize.Op.contains]: {
                    ops: [
                        {
                            insert: {
                                'block-embed': {
                                    embedData: {
                                        id: freehandDocumentId
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        },
        attributes: [
            Sequelize.fn('DISTINCT', Sequelize.col('documentId')),
            'documentId'
        ]
    }
    const revisions = await DocumentRevision.findAll(query)

    SocketManager.getInstance().sendFreehandUpdated(
        revisions.map(property('documentId')),
        freehandDocumentId
    )
}
