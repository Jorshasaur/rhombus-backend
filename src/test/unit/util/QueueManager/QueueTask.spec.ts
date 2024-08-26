import {
    addUniqueJob,
    DEFAULT_TIMEOUT,
    acquireLock
} from '../../../../util/QueueManager/QueueTask'
import mockQueue from '../../../mocks/mock-queue'
import 'jest-extended'

let queue: any = {}
let task = 'task'
let jobId = 'jobId'
let lockKey = 'jobId:uniquejoblock'

describe('QueueTask', () => {
    describe('acquireLock', () => {
        beforeEach(() => {
            queue = new mockQueue()
        })

        it('should acquire lock', async () => {
            const callbackSpy = jest.fn()

            await acquireLock(queue, jobId, callbackSpy)

            expect(queue.client.takeLock).toBeCalledWith([
                lockKey,
                queue.token,
                10
            ])
            expect(queue.client.releaseLock).toBeCalledWith([
                lockKey,
                queue.token
            ])
            expect(queue.isReady).toHaveBeenCalledBefore(queue.client.takeLock)
            expect(queue.client.takeLock).toHaveBeenCalledBefore(callbackSpy)
            expect(callbackSpy).toHaveBeenCalledBefore(queue.client.releaseLock)
        })

        it('should acquire lock for async function', async () => {
            const callbackSpy = jest.fn()

            await acquireLock(queue, jobId, async () => {
                return new Promise((resolve) => {
                    process.nextTick(() => {
                        callbackSpy()
                        resolve()
                    })
                })
            })

            expect(queue.client.takeLock).toBeCalledWith([
                lockKey,
                queue.token,
                10
            ])
            expect(queue.client.releaseLock).toBeCalledWith([
                lockKey,
                queue.token
            ])
            expect(queue.client.takeLock).toHaveBeenCalledBefore(callbackSpy)
            expect(callbackSpy).toHaveBeenCalledBefore(queue.client.releaseLock)
        })

        it('should release lock if there was an error', async () => {
            try {
                await acquireLock(queue, jobId, () => {
                    throw new Error('fail')
                })
            } catch (err) {
                expect(err.message).toEqual('fail')
            }

            expect(queue.client.takeLock).toBeCalled()
            expect(queue.client.releaseLock).toBeCalled()
        })
    })

    describe('addUniqueJob', () => {
        beforeEach(() => {
            queue = new mockQueue()
        })

        it('can perform a brand new job', async () => {
            let data = {
                testData: 'testData'
            }

            await addUniqueJob(queue, data, task, jobId, undefined, undefined)

            expect(queue.add).toBeCalledWith(task, data, {
                delay: 0,
                jobId,
                removeOnComplete: true,
                removeOnFail: true,
                timeout: DEFAULT_TIMEOUT
            })
        })

        it('it can start a new job after it found an old job', async () => {
            queue.getJob = async () => {
                return {
                    remove: jest.fn()
                }
            }

            let data = {
                testData: 'testData'
            }

            let callback = jest.fn(() => data)

            await addUniqueJob(
                queue,
                data,
                task,
                jobId,
                undefined,
                undefined,
                callback
            )

            expect(callback).toBeCalled()

            expect(queue.add).toBeCalledWith(task, data, {
                delay: 0,
                jobId,
                removeOnComplete: true,
                removeOnFail: true,
                timeout: DEFAULT_TIMEOUT
            })
        })
        it('it can start a new job after job removal fails', async () => {
            const finished = jest.fn()
            queue.getJob = async () => {
                return {
                    remove: jest.fn(() => {
                        throw new Error()
                    }),
                    finished
                }
            }

            let data = {
                testData: 'testData'
            }

            let callback = jest.fn(() => data)

            await addUniqueJob(
                queue,
                data,
                task,
                jobId,
                undefined,
                undefined,
                callback
            )

            expect(callback).not.toBeCalled()

            expect(finished).toBeCalled()

            expect(queue.add).toBeCalledWith(task, data, {
                delay: 0,
                jobId,
                removeOnComplete: true,
                removeOnFail: true,
                timeout: DEFAULT_TIMEOUT
            })
        })
    })
})
