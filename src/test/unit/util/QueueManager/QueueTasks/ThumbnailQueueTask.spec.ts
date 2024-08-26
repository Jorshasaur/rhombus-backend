import {
    ThumbnailQueueTask,
    THUMBNAIL_JOB_TIMEOUT
} from '../../../../../util/QueueManager/QueueTasks/ThumbnailQueueTask'
import { Job, JobStatus } from 'bull'
import * as Bluebird from 'bluebird'
import { RequestResponseMock } from '../../../../utils'
import { getReducedRequestFromRequest } from '../../../../../interfaces/ReducedRequest'
import { FreehandHeaders } from '../../../../../interfaces/FreehandHeaders'
import * as ThumbnailerService from '../../../../../services/ThumbnailerService'
import { Document } from '../../../../../models/Document'
import { QueueTaskPusher } from '../../../../../util/QueueManager'
import { THIRTY_SECONDS_IN_MS } from '../../../../../constants/Integers'
import mockQueue from '../../../../mocks/mock-queue'

describe('ThumbnailQueueTask', () => {
    let thumbnailQueueTask: ThumbnailQueueTask

    const createThumbnailSpy = jest.spyOn(ThumbnailerService, 'createThumbnail')

    beforeEach(() => {
        thumbnailQueueTask = new ThumbnailQueueTask()
    })

    afterEach(() => {
        createThumbnailSpy.mockClear()
    })

    describe('Thumbnail Worker Function', () => {
        const status: JobStatus = 'completed'

        const freehandHeaders: FreehandHeaders = {
            ip: 'IP',
            userAgent: 'USER_AGENT',
            hostname: 'X_FORWARDED_HOST'
        }

        const goodJob: Job = {
            id: '123',
            data: {
                // @ts-ignore
                req: getReducedRequestFromRequest(new RequestResponseMock()),
                documentId: 'aabbcc',
                operation: {},
                freehandHeaders
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

        it('should reject the job if sending the email has an error', async () => {
            let hasError = false

            createThumbnailSpy.mockImplementationOnce(() => {
                throw new Error()
            })

            try {
                await thumbnailQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }

            expect(hasError).toBe(true)
        })

        const document = {
            save: jest.fn(),
            id: '1',
            teamId: '1',
            thumbnailAssetKey: null
        }

        it('should save the job', async () => {
            Document.findOne = jest.fn(() => {
                return document
            })
            let hasError = false
            const assetKey = 'test-asset-key'
            createThumbnailSpy.mockReturnValueOnce(assetKey)

            try {
                await thumbnailQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }
            expect(document.thumbnailAssetKey).toBe(assetKey)
            expect(document.save).toHaveBeenCalled()
            expect(hasError).toBe(false)

            expect(
                QueueTaskPusher.getInstance().emitEventBusEvent
            ).toBeCalledWith({
                eventData: {
                    documentId: '1',
                    teamId: '1'
                },
                type: 'document.thumbnail.updated.v1'
            })
        })
    })

    describe('Thumbnail task pusher', () => {
        it('should push the task to the queue', async () => {
            const documentId = 'test-document-id'
            const taskOpts = {
                delay: THIRTY_SECONDS_IN_MS,
                jobId: `thumbnail-${documentId}`,
                removeOnComplete: true,
                removeOnFail: true,
                timeout: THUMBNAIL_JOB_TIMEOUT
            }
            const queue = new mockQueue(null)

            const logger = {
                debug: jest.fn()
            }

            const data = {
                documentId
            }

            // @ts-ignore
            await thumbnailQueueTask.taskPusher(queue, logger, data)
            expect(queue.getJob).toHaveBeenCalled()
            expect(queue.add).toHaveBeenCalledWith(
                thumbnailQueueTask.taskName,
                data,
                taskOpts
            )
        })

        it('should remove duplicate tasks from the queue, then push the task to the queue', async () => {
            const documentId = 'test-document-id'
            const jobId = `thumbnail-${documentId}`
            const taskOpts = {
                delay: THIRTY_SECONDS_IN_MS,
                jobId,
                removeOnComplete: true,
                removeOnFail: true,
                timeout: THUMBNAIL_JOB_TIMEOUT
            }
            const job = {
                remove: jest.fn()
            }
            const queue = new mockQueue(job)

            const logger = {
                debug: jest.fn()
            }

            const data = {
                documentId
            }

            // @ts-ignore
            await thumbnailQueueTask.taskPusher(queue, logger, data)
            expect(queue.getJob).toHaveBeenCalled()
            expect(job.remove).toHaveBeenCalled()
            expect(queue.add).toHaveBeenCalledWith(
                thumbnailQueueTask.taskName,
                data,
                taskOpts
            )
        })
    })
})
