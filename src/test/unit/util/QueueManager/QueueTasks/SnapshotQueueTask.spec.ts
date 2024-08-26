import { SnapshotQueueTask } from '../../../../../util/QueueManager/QueueTasks/SnapshotQueueTask'
import { Job, JobStatus } from 'bull'
import SequelizeManager from '../../../../../util/SequelizeManager'
import * as Bluebird from 'bluebird'
import { Document } from '../../../../../models/Document'

describe('SnapshotQueueTask', () => {
    let snapshotQueueTask: SnapshotQueueTask

    beforeEach(() => {
        snapshotQueueTask = new SnapshotQueueTask()
    })

    describe('Snapshot Worker Function', () => {
        const status: JobStatus = 'completed'
        const badJob: Job = {
            id: '123',
            data: null,
            attemptsMade: 0,
            lockKey: () => '456',
            releaseLock: () => {
                return Bluebird.Promise.resolve()
            },
            takeLock: () => {
                return Bluebird.Promise.resolve(1)
            },
            progress: (value: any) => {
                return Bluebird.Promise.resolve()
            },
            update: (data: any) => {
                return Bluebird.Promise.resolve()
            },
            remove: () => {
                return Bluebird.Promise.resolve()
            },
            retry: () => {
                return Bluebird.Promise.resolve()
            },
            finished: () => {
                return Bluebird.Promise.resolve()
            },
            promote: () => {
                return Bluebird.Promise.resolve()
            },
            getState: () => {
                return Bluebird.Promise.resolve(status)
            }
        }
        const goodJob: Job = {
            id: '123',
            data: { documentId: 'aabbcc' },
            attemptsMade: 0,
            lockKey: () => '456',
            releaseLock: () => {
                return Bluebird.Promise.resolve()
            },
            takeLock: () => {
                return Bluebird.Promise.resolve(1)
            },
            progress: (value: any) => {
                return Bluebird.Promise.resolve()
            },
            update: (data: any) => {
                return Bluebird.Promise.resolve()
            },
            remove: () => {
                return Bluebird.Promise.resolve()
            },
            retry: () => {
                return Bluebird.Promise.resolve()
            },
            finished: () => {
                return Bluebird.Promise.resolve()
            },
            promote: () => {
                return Bluebird.Promise.resolve()
            },
            getState: () => {
                return Bluebird.Promise.resolve(status)
            }
        }

        it('should reject the job if the job data is missing', async () => {
            SequelizeManager.prototype.init = jest.fn(() => {
                return true
            })

            let hasError = false
            try {
                await snapshotQueueTask.worker(badJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })

        it('should reject the job if the document cant be found', async () => {
            SequelizeManager.prototype.init = jest.fn(() => {
                return true
            })
            Document.findOne = jest.fn(() => {
                return null
            })

            let hasError = false
            try {
                await snapshotQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })

        it('should save the job', async () => {
            SequelizeManager.prototype.init = jest.fn(() => {
                return true
            })
            Document.findOne = jest.fn(() => {
                return {
                    id: '1',
                    teamId: '1',
                    saveSnapshot: jest.fn()
                }
            })
            let hasError = false
            try {
                await snapshotQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(false)
        })
    })

    describe('Snapshot task pusher', () => {
        it('should push the task to the queue', () => {
            let queue = {
                add: jest.fn()
            }

            let logger = {
                debug: jest.fn()
            }

            let data = {
                test: 'test'
            }

            // @ts-ignore
            snapshotQueueTask.taskPusher(queue, logger, data)

            expect(queue.add).toBeCalledWith(snapshotQueueTask.taskName, data)
        })
    })
})
