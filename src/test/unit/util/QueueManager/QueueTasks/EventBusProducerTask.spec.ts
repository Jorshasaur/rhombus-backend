import { EventBusProducerTask } from '../../../../../util/QueueManager/QueueTasks/EventBusProducerTask'
import { Job, JobStatus } from 'bull'
import SequelizeManager from '../../../../../util/SequelizeManager'
import * as Bluebird from 'bluebird'
import { emit } from '../../../../../event-bus/producer'

describe('EventBusProducerTask', () => {
    let queueTask: EventBusProducerTask

    beforeEach(() => {
        queueTask = new EventBusProducerTask()
    })

    describe('EventBusProducerTask Worker Function', () => {
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
            data: {
                type: 'document.viewed.v1',
                eventData: { documentId: '1' }
            },
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
                await queueTask.worker(badJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })

        it('should emit to event bus', async () => {
            let hasError = false
            try {
                await queueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(false)
            expect(emit).toBeCalledWith(
                goodJob.data.type,
                goodJob.data.eventData
            )
        })
    })

    describe('EventBusProducerTask task pusher', () => {
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
            queueTask.taskPusher(queue, logger, data)

            expect(queue.add).toBeCalledWith(queueTask.taskName, data)
        })
    })
})
