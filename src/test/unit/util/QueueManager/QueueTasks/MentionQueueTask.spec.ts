import {
    MentionQueueTask,
    FIVE_MINUTES_IN_MS
} from '../../../../../util/QueueManager/QueueTasks/MentionQueueTask'
import { Job, JobStatus } from 'bull'
import * as Bluebird from 'bluebird'
import { RequestResponseMock } from '../../../../utils'
import { getReducedRequestFromRequest } from '../../../../../interfaces/ReducedRequest'
import { FreehandHeaders } from '../../../../../interfaces/FreehandHeaders'
import * as EmailSender from '../../../../../services/EmailSender'
import * as MentionEmail from '../../../../../services/MentionEmail'
import { LaunchDarklyHelper } from '../../../../../util/LaunchDarklyHelper'

describe('MentionQueueTask', () => {
    let mentionQueueTask: MentionQueueTask

    const sendEmailSpy = jest.spyOn(EmailSender, 'send')
    const createMentionEmailSpy = jest.spyOn(MentionEmail, 'create')

    const taskOpts = {
        delay: FIVE_MINUTES_IN_MS
    }

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

    beforeEach(() => {
        mentionQueueTask = new MentionQueueTask()
    })

    afterEach(() => {
        sendEmailSpy.mockClear()
        createMentionEmailSpy.mockClear()
    })

    describe('Mention Worker Function', () => {
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

            sendEmailSpy.mockImplementationOnce(() => {
                throw new Error()
            })

            try {
                await mentionQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }

            expect(hasError).toBe(true)
        })

        it('should save the job', async () => {
            let hasError = false

            sendEmailSpy.mockReturnValueOnce(true)
            createMentionEmailSpy.mockReturnValueOnce(true)

            try {
                await mentionQueueTask.worker(goodJob)
            } catch (error) {
                hasError = true
            }

            expect(hasError).toBe(false)
        })
    })

    describe('Mention task pusher', () => {
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
            mentionQueueTask.taskPusher(queue, logger, data)

            expect(queue.add).toBeCalledWith(
                mentionQueueTask.taskName,
                data,
                taskOpts
            )
        })
    })
})
