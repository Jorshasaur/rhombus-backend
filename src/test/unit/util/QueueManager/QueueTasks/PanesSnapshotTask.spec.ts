import { PanesSnapshotTask } from '../../../../../util/QueueManager/QueueTasks/PanesSnapshotTask'
import { Job, JobStatus } from 'bull'
import * as Bluebird from 'bluebird'
import { Pane } from '../../../../../models/Pane'

const mockTransaction: any = Symbol('transaction')

jest.mock('../../../../../util/SequelizeManager', () => {
    return {
        default: {
            instance: {
                sequelize: {
                    transaction(callback: Function) {
                        return callback(mockTransaction)
                    }
                },

                createAdvisoryLock: jest.fn(() => {
                    return Promise.resolve()
                })
            },

            getInstance() {
                return this.instance
            }
        }
    }
})

describe('PanesSnapshotTask', () => {
    let panesSnapshotTask: PanesSnapshotTask

    beforeEach(() => {
        panesSnapshotTask = new PanesSnapshotTask()
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
            data: { paneId: 'aabbcc', teamId: '12345' },
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
            let hasError = false
            try {
                await panesSnapshotTask.worker(badJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })

        it('should reject the job if the pane cant be found', async () => {
            Pane.findOne = jest.fn(() => {
                return null
            })

            let hasError = false
            try {
                await panesSnapshotTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })

        it('should save the job', async () => {
            Pane.findOne = jest.fn(() => {
                return {
                    id: '1',
                    teamId: '1',
                    saveSnapshot: jest.fn()
                }
            })
            let hasError = false
            try {
                await panesSnapshotTask.worker(goodJob)
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
            panesSnapshotTask.taskPusher(queue, logger, data)

            expect(queue.add).toBeCalledWith(panesSnapshotTask.taskName, data)
        })
    })
})
