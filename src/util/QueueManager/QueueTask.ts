import { Logger } from '../Logger'
import Bugsnag from '../../bugsnag'
import { Queue } from './queueClient'
import { Job } from 'bull'

export const DEFAULT_TIMEOUT = 5000

interface DataCallback {
    (prevData: any, newData: any): any
}

export interface QueueTask {
    taskName: string
    worker(job: Job): Promise<string>
    taskPusher(
        queue: Queue,
        logger: Logger,
        data: any
    ): PromiseLike<Job | undefined>
}

function getUniqueJobLockKey(queue: Queue, jobId: string) {
    return queue.toKey(jobId) + ':uniquejoblock'
}

async function takeLock(queue: Queue, lockKey: string) {
    return queue.client.takeLock([
        lockKey,
        queue.token,
        queue.settings.lockDuration
    ])
}

async function releaseLock(queue: Queue, lockKey: string) {
    return queue.client.releaseLock([lockKey, queue.token])
}

export async function acquireLock(
    queue: Queue,
    jobId: string,
    callback: () => Promise<Job | undefined>
) {
    await queue.isReady()
    const lockKey = getUniqueJobLockKey(queue, jobId)
    const lockAcquired = await takeLock(queue, lockKey)
    if (!lockAcquired) {
        return
    }

    try {
        return await callback()
    } catch (err) {
        throw err
    } finally {
        const lockReleased = await releaseLock(queue, lockKey)
        if (!lockReleased) {
            Bugsnag.notify(`addUniqueJob - Lock was not released for ${jobId}`)
        }
    }
}

export async function addUniqueJob(
    queue: Queue,
    data: any,
    task: string,
    jobId: string,
    delay: number = 0,
    timeout: number = DEFAULT_TIMEOUT,
    dataCallback?: DataCallback
) {
    return acquireLock(queue, jobId, async () => {
        const job = await queue.getJob(jobId)
        let added = true

        if (job) {
            try {
                // Try to remove the job. If removal fails, the job was locked
                await job.remove()
                if (dataCallback) {
                    data = dataCallback(job.data, data)
                }
                added = false
            } catch {
                // If job is locked, wait for job to finish or fail
                await job.finished()
            }
        }

        const newJob = await queue.add(task, data, {
            delay,
            jobId,
            removeOnComplete: true,
            removeOnFail: true,
            timeout
        })

        if (added) {
            return newJob
        } else {
            return
        }
    })
}
