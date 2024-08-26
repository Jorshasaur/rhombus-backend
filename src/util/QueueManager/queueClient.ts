import * as Queue from 'bull'
import * as Redis from 'ioredis'

export interface Queue extends Queue.Queue {
    client: QueueClient
    token: string
    settings: {
        lockDuration: number
    }
}

interface QueueClient extends Redis.Redis {
    addJob: Function
    addJobBuffer: Function
    addWorkerData: Function
    addWorkerDataBuffer: Function
    extendLock: Function
    extendLockBuffer: Function
    isFinished: Function
    isFinishedBuffer: Function
    isJobInList: Function
    isJobInListBuffer: Function
    moveStalledJobsToWait: Function
    moveStalledJobsToWaitBuffer: Function
    moveToActive: Function
    moveToActiveBuffer: Function
    moveToDelayed: Function
    moveToDelayedBuffer: Function
    moveToFinished: Function
    moveToFinishedBuffer: Function
    pause: Function
    pauseBuffer: Function
    releaseLock: Function
    releaseLockBuffer: Function
    removeJob: Function
    removeJobBuffer: Function
    removeRepeatable: Function
    removeRepeatableBuffer: Function
    reprocessJob: Function
    reprocessJobBuffer: Function
    retryJob: Function
    retryJobBuffer: Function
    takeLock: Function
    takeLockBuffer: Function
    updateDelaySet: Function
    updateDelaySetBuffer: Function
    updateProgress: Function
    updateProgressBuffer: Function
}
