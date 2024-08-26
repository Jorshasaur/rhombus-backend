import { UpdateLastViewedTask } from '../../../../../util/QueueManager/QueueTasks/UpdateLastViewedTask'
import { Job, JobStatus } from 'bull'
import SequelizeManager from '../../../../../util/SequelizeManager'
import * as Bluebird from 'bluebird'
import { DocumentMembership } from '../../../../../models/DocumentMembership'
import { Document } from '../../../../../models/Document'
import { QueueTaskPusher } from '../../../../../util/QueueManager'

describe('UpdateLastViewedTask', () => {
    let updateLastViewedTask: UpdateLastViewedTask

    beforeEach(() => {
        updateLastViewedTask = new UpdateLastViewedTask()
    })

    describe('UpdateLastViewed Worker Function', () => {
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
            data: { documentId: 'aabbcc', userId: 1 },
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
                await updateLastViewedTask.worker(badJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })

        it('should reject the job if the document membership cant be found', async () => {
            SequelizeManager.prototype.init = jest.fn(() => {
                return true
            })
            DocumentMembership.findOne = jest.fn(() => {
                return null
            })

            let hasError = false
            try {
                await updateLastViewedTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })

        it('should save the lastViewed date', async () => {
            SequelizeManager.prototype.init = jest.fn(() => {
                return true
            })
            DocumentMembership.findOne = jest.fn(() => {
                return {
                    save: jest.fn()
                }
            })

            Document.findById = jest.fn(() => {
                return {
                    id: 'aabbcc',
                    teamId: '1'
                }
            })

            let hasError = false
            try {
                await updateLastViewedTask.worker(goodJob)
            } catch (error) {
                console.log(error)
                hasError = true
            }
            expect(hasError).toBe(false)

            expect(
                QueueTaskPusher.getInstance().emitEventBusEvent
            ).toBeCalledWith({
                eventData: {
                    documentId: 'aabbcc',
                    teamId: '1',
                    userId: 1
                },
                type: 'document.viewed.v1'
            })
        })
    })

    describe('UpdateLastViewed task pusher', () => {
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
            updateLastViewedTask.taskPusher(queue, logger, data)

            expect(queue.add).toBeCalledWith(
                updateLastViewedTask.taskName,
                data
            )
        })
    })
})
