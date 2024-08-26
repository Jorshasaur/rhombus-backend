import {
    UPDATE_EMAIL_JOB_DELAY,
    UPDATE_EMAIL_JOB_TIMEOUT,
    UpdateEmailQueueTask,
    updateJobData
} from '../../../../../util/QueueManager/QueueTasks/UpdateEmailQueueTask'
import { Job, JobStatus } from 'bull'
import * as Bluebird from 'bluebird'
import { RequestResponseMock } from '../../../../utils'
import { getReducedRequestFromRequest } from '../../../../../interfaces/ReducedRequest'
import { FreehandHeaders } from '../../../../../interfaces/FreehandHeaders'
import * as EmailSender from '../../../../../services/EmailSender'
import * as DocumentUpdateEmail from '../../../../../services/DocumentUpdateEmail'
import { LaunchDarklyHelper } from '../../../../../util/LaunchDarklyHelper'
import SequelizeManager from '../../../../../util/SequelizeManager'
import mockQueue from '../../../../mocks/mock-queue'

describe('UpdateEmailQueueTask', () => {
    let updateEmailQueueTask: UpdateEmailQueueTask
    const sendUpdateEmailSpy = jest.spyOn(EmailSender, 'send')
    const createDocumentUpdateEmailSpy = jest.spyOn(
        DocumentUpdateEmail,
        'create'
    )

    LaunchDarklyHelper.getInstance = jest.fn(() => {
        return {
            connect() {
                return true
            },
            waitForConnect() {
                return new Promise((resolve) => resolve())
            }
        }
    })

    SequelizeManager.getInstance().initAsWorker = jest.fn(async (callback) => {
        return await callback()
    })

    beforeEach(() => {
        updateEmailQueueTask = new UpdateEmailQueueTask()
    })

    afterEach(() => {
        sendUpdateEmailSpy.mockClear()
    })

    describe('Update Email Worker Function', () => {
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
                req: getReducedRequestFromRequest(
                    new RequestResponseMock().request
                ),
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

            sendUpdateEmailSpy.mockImplementationOnce(() => {
                throw new Error()
            })

            try {
                await updateEmailQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }

            expect(hasError).toBe(true)
        })

        it('should save the job', async () => {
            let hasError = false

            sendUpdateEmailSpy.mockReturnValueOnce(true)
            createDocumentUpdateEmailSpy.mockReturnValueOnce(true)

            try {
                await updateEmailQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }

            expect(hasError).toBe(false)
        })
    })

    describe('Update email task pusher', () => {
        it('should push the task to the queue', async () => {
            const queue = new mockQueue()

            const logger = {
                debug: jest.fn()
            }

            const data = {
                test: 'test',
                documentId: '1234'
            }

            // @ts-ignore
            await updateEmailQueueTask.taskPusher(queue, logger, data)

            expect(queue.add).toBeCalledWith(
                updateEmailQueueTask.taskName,
                data,
                {
                    delay: UPDATE_EMAIL_JOB_DELAY,
                    jobId: `update-email-${data.documentId}`,
                    removeOnComplete: true,
                    removeOnFail: true,
                    timeout: UPDATE_EMAIL_JOB_TIMEOUT
                }
            )
        })
        it('should update panes in the job data', async () => {
            const oldData = {
                test: 'test',
                documentId: '1234',
                panes: {
                    '1233445': 5
                }
            }

            const noPanes = {
                test: 'test',
                documentId: '1234'
            }

            const newData = {
                test: 'test',
                documentId: '1234',
                panes: {
                    '1233445': 10,
                    '4455': 1
                }
            }

            const newDataNoPanes = {
                test: 'test',
                documentId: '1234'
            }

            // @ts-ignore
            const newDataResult = updateJobData(oldData, newData)
            expect(newDataResult.panes).toEqual({
                '1233445': 5,
                '4455': 1
            })
            // @ts-ignore
            const noPanesResult = updateJobData(noPanes, newData)
            expect(noPanesResult.panes).toEqual({
                '1233445': 5,
                '4455': 1
            })
            // @ts-ignore
            const noPanesDataResult = updateJobData(newData, newDataNoPanes)
            expect(noPanesDataResult.panes).toEqual({
                '1233445': 5,
                '4455': 1
            })
        })
    })
})
