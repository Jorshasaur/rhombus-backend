import {
    DocumentSessionQueueTask,
    SIXTY_MINUTES_IN_MS,
    updateJobData
} from '../../../../../util/QueueManager/QueueTasks/DocumentSessionQueueTask'
import * as QueueTask from '../../../../../util/QueueManager/QueueTask'
import { Job, JobStatus } from 'bull'
import * as Bluebird from 'bluebird'
import DocumentSessionAnalytics from '../../../../../analytics/AnalyticsBuilders/DocumentSessionAnalytics'

let trackSpy = jest
    .spyOn(DocumentSessionAnalytics.prototype, 'track')
    .mockImplementation(jest.fn())

// @ts-ignore
QueueTask.addUniqueJob = jest.fn()

describe('DocumentSessionQueueTask', () => {
    let documentSessionQueueTask: DocumentSessionQueueTask

    beforeEach(() => {
        documentSessionQueueTask = new DocumentSessionQueueTask()
    })

    describe('DocumentSession Worker Function', () => {
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

        it('should do analytics for the document session', async () => {
            await documentSessionQueueTask.worker(goodJob)
            expect(trackSpy).toBeCalled()
        })

        it('should reject the job if the job data is missing', async () => {
            let hasError = false
            try {
                await documentSessionQueueTask.worker(badJob)
            } catch (error) {
                hasError = true
            }
            expect(hasError).toBe(true)
        })
    })

    describe('DocumentSession task pusher', () => {
        it('should push the task to the queue', () => {
            let queue = {}

            let logger = {
                debug: jest.fn()
            }

            let data = {
                documentId: 'documentId',
                userId: 'userId',
                numberOfEdits: 0,
                numberOfDeletes: 0,
                sessionStart: new Date(),
                test: 'test'
            }

            let jobId: string = [
                documentSessionQueueTask.taskName,
                data.documentId,
                data.userId
            ].join(':')

            // @ts-ignore
            documentSessionQueueTask.taskPusher(queue, logger, data)

            expect(QueueTask.addUniqueJob).toBeCalledWith(
                queue,
                data,
                documentSessionQueueTask.taskName,
                jobId,
                SIXTY_MINUTES_IN_MS,
                undefined,
                updateJobData
            )
        })
    })
})
