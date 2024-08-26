import * as Delta from 'quill-delta'
import { FreehandHeaders } from '../../../interfaces/FreehandHeaders'
import {
    getReducedRequestFromRequest,
    ReducedRequest
} from '../../../interfaces/ReducedRequest'
import { Permissions } from '../../../middleware/Permissions'
import { Asset } from '../../../models/Asset'
import { Document } from '../../../models/Document'
import { DocumentMembership } from '../../../models/DocumentMembership'
import { DocumentRevision } from '../../../models/DocumentRevision'
import * as DocumentUpdateEmail from '../../../services/DocumentUpdateEmail'
import EmailerApiService, {
    EmailTemplateType
} from '../../../services/EmailerApiService'
import * as MentionEmail from '../../../services/MentionEmail'
import * as EmailSender from '../../../services/EmailSender'
import { UsersApiService } from '../../../services/UsersApiService'
import { LaunchDarklyHelper } from '../../../util/LaunchDarklyHelper'
import {
    FreehandHeadersMock,
    RequestResponseMock,
    DEFAULT_REQUEST_USER_ID
} from '../../utils'
import { getDocumentRecord } from '../controllers/utils'

let canSendMentionForDocumentSpy = jest.spyOn(
    Permissions.prototype,
    'canSendMentionForDocument'
)

async function sendEmail(
    documentId: string,
    revision: number,
    request: ReducedRequest,
    headers: FreehandHeaders
) {
    const emailTemplate = await DocumentUpdateEmail.create(
        documentId,
        revision,
        request,
        headers
    )
    if (emailTemplate != null) {
        EmailSender.send(emailTemplate, request)
    }
}

function getDocumentOps(mentionData: any) {
    return [
        {
            insert: 'Untitled'
        },
        {
            attributes: {
                header: 1,
                id: 'cjftvg0x200002yqkrpbsqnrc'
            },
            insert: '\n'
        },
        {
            attributes: {
                id: 'cjftvg0x200012yqky41wvtzf'
            },
            insert: 'This is a document whose text is synced in real time'
        },
        {
            attributes: {
                author: '9',
                id: 'cjftvgs6400083i5o8soerwwc'
            },
            insert: '\n'
        },
        {
            attributes: {
                author: '9'
            },
            insert: 'Line with mention '
        },
        {
            attributes: {
                author: '9'
            },
            insert: mentionData
        },
        {
            attributes: {
                author: '9',
                id: 'cjftvgs6400073i5oda664vfy'
            },
            insert: '\n'
        },
        {
            attributes: {
                author: '9'
            },
            insert: 'Another line'
        },
        {
            attributes: {
                author: '9',
                id: 'cjftvg80r00053i5oyhma4dvy'
            },
            insert: '\n'
        }
    ]
}

function getMentionsOps(mentionData: any) {
    return [
        {
            retain: 80
        },
        {
            attributes: {
                author: '9'
            },
            insert: mentionData
        }
    ]
}

function getUserProfile(userId: number, email: string = 'noone@nowhere.com') {
    return {
        userId,
        teamId: 15,
        name: 'Some Guy',
        email,
        avatarId: 'aabbcc',
        avatarUrl: 'http://google.com'
    }
}

describe('EmailSender', () => {
    beforeEach(() => {
        Document.unscoped = jest.fn(() => {
            return Document
        })
        canSendMentionForDocumentSpy.mockImplementation(async () => true)
        DocumentRevision.findAll = jest.fn(() => {
            return [
                {
                    userId: 1,
                    delta: { ops: { find: jest.fn() } }
                }
            ]
        })
        DocumentMembership.getSubscribedMembers = jest.fn(() => {
            return [{ userId: 1 }]
        })
    })
    describe('MentionEmail', () => {
        it('should send mention email to mentioned user', async () => {
            const documentId = '1'
            const userId = 1234

            LaunchDarklyHelper.getInstance = jest.fn(() => {
                return {
                    getFeatureFlagByUserAndTeamId() {
                        return true
                    }
                }
            })

            UsersApiService.prototype.getUserProfile = jest.fn(
                (userId: number) => {
                    return Promise.resolve(getUserProfile(userId))
                }
            )

            const mentionData = {
                mention: {
                    id: userId,
                    name: 'Test user'
                }
            }
            const documentOps = getDocumentOps(mentionData)

            Document.findOne = jest.fn(() => {
                return Promise.resolve({
                    id: '1',
                    title: 'Untitled',
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            delta: new Delta(documentOps)
                        })
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([] as DocumentRevision[])
                    },
                    getRevision() {
                        return Promise.resolve({
                            delta: new Delta(getMentionsOps(mentionData))
                        })
                    }
                })
            })

            Asset.findAll = jest.fn(() => {
                return Promise.resolve([])
            })

            let req = new RequestResponseMock().request

            let freehandHeaders: FreehandHeaders = {
                ip: '',
                userAgent: '',
                hostname: 'in.local.invision.works'
            }

            let reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                req
            )

            const res = await MentionEmail.create(
                documentId,
                undefined,
                1,
                reducedRequest,
                freehandHeaders
            )

            const expectedContent =
                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">This is a document whose text is synced in real time</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Line with mention <a style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0;">@Test user</a></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Another line</p>'

            expect(res).toEqual({
                type: EmailTemplateType.RhombusMentionNotification,
                from: 'InVision App <no-reply@invisionapp.com>',
                subject: 'New mention in “Untitled”',
                templateVariables: {
                    document_title: 'Untitled',
                    document_url:
                        'https://in.local.invision.works/rhombus/Untitled-2',
                    mention_content: expectedContent,
                    user_avatar: 'http://google.com',
                    user_name: 'Some Guy'
                },
                recipients: [getUserProfile(userId)]
            })
        })

        it('should not send mention email if mentioned user is current user', async () => {
            const documentId = '1'
            const userId = 1

            const mentionData = {
                mention: {
                    id: userId,
                    name: 'Test user'
                }
            }
            const documentOps = getDocumentOps(mentionData)

            Document.findOne = jest.fn(() => {
                return Promise.resolve({
                    id: '1',
                    title: 'Untitled',
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            delta: new Delta(documentOps)
                        })
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([] as DocumentRevision[])
                    },
                    getRevision() {
                        return Promise.resolve({
                            delta: new Delta(getMentionsOps(mentionData))
                        })
                    }
                })
            })

            let req = new RequestResponseMock().request

            let freehandHeaders: FreehandHeaders = {
                ip: '',
                userAgent: '',
                hostname: 'in.local.invision.works'
            }

            let reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                req
            )

            const res = await MentionEmail.create(
                documentId,
                undefined,
                1,
                reducedRequest,
                freehandHeaders
            )
            expect(res).toBeUndefined()
        })

        it("should fail if the mention can't be found", async () => {
            const documentId = '1'
            const userId = 1234

            LaunchDarklyHelper.getInstance = jest.fn(() => {
                return {
                    getFeatureFlagByUserAndTeamId() {
                        return true
                    }
                }
            })

            UsersApiService.prototype.getUserProfile = jest.fn(
                (userId: number) => {
                    return Promise.resolve(getUserProfile(userId))
                }
            )

            const mentionData = {
                mention: {
                    id: userId,
                    name: 'Test user'
                }
            }
            const documentOps = getDocumentOps(mentionData)

            Document.findOne = jest.fn(() => {
                return Promise.resolve({
                    id: '1',
                    title: 'Untitled',
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            delta: new Delta(documentOps)
                        })
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([] as DocumentRevision[])
                    },
                    getRevision() {
                        return Promise.resolve(null)
                    }
                })
            })

            Asset.findAll = jest.fn(() => {
                return Promise.resolve([])
            })

            let req = new RequestResponseMock().request

            let freehandHeaders: FreehandHeaders = {
                ip: '',
                userAgent: '',
                hostname: 'in.local.invision.works'
            }

            let reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                req
            )

            try {
                await MentionEmail.create(
                    documentId,
                    undefined,
                    1,
                    reducedRequest,
                    freehandHeaders
                )
            } catch (e) {
                expect(e).toEqual(
                    new Error(
                        "MentionEmail#document couldn't find mention revision: 1"
                    )
                )
            }
        })

        it('should send mention email to document users', async () => {
            const documentId = '1'

            LaunchDarklyHelper.getInstance = jest.fn(() => {
                return {
                    getFeatureFlagByUserAndTeamId() {
                        return true
                    }
                }
            })

            UsersApiService.prototype.getUserProfile = jest.fn(() => {
                return Promise.resolve(getUserProfile(10))
            })

            UsersApiService.prototype.getUserProfilesForAdmin = jest.fn(() => {
                return Promise.resolve([
                    getUserProfile(1, 'first@nowhere.com'),
                    getUserProfile(7, 'second@nowhere.com'),
                    getUserProfile(10)
                ])
            })

            const mentionData = {
                'document-mention': {
                    name: 'Document users',
                    documentMention: true
                }
            }
            const documentOps = getDocumentOps(mentionData)

            Document.findOne = jest.fn(() => {
                return Promise.resolve({
                    id: '1',
                    title: 'Untitled',
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            delta: new Delta(documentOps)
                        })
                    },
                    members() {
                        return Promise.resolve([
                            {
                                userId: 1
                            },
                            {
                                userId: 7
                            }
                        ])
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([] as DocumentRevision[])
                    },
                    getRevision() {
                        return Promise.resolve({
                            delta: new Delta(getMentionsOps(mentionData))
                        })
                    }
                })
            })

            Asset.findAll = jest.fn(() => {
                return Promise.resolve([])
            })

            let req = new RequestResponseMock().request

            let freehandHeaders: FreehandHeaders = {
                ip: '',
                userAgent: '',
                hostname: 'in.local.invision.works'
            }

            let reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                req
            )

            const res = await MentionEmail.create(
                documentId,
                undefined,
                1,
                reducedRequest,
                freehandHeaders
            )

            const expectedContent =
                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">This is a document whose text is synced in real time</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Line with mention <a style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0;">@Doc</a></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Another line</p>'

            expect(res).toEqual({
                type: EmailTemplateType.RhombusMentionNotification,
                from: 'InVision App <no-reply@invisionapp.com>',
                subject: 'New mention in “Untitled”',
                templateVariables: {
                    document_title: 'Untitled',
                    document_url:
                        'https://in.local.invision.works/rhombus/Untitled-2',
                    mention_content: expectedContent,
                    user_avatar: 'http://google.com',
                    user_name: 'Some Guy'
                },
                recipients: [
                    getUserProfile(1, 'first@nowhere.com'),
                    getUserProfile(7, 'second@nowhere.com')
                ]
            })
        })

        it('should not send email for users without LD access', async () => {
            const documentId = '1'
            const userId = 1234

            LaunchDarklyHelper.getInstance = jest.fn(() => {
                return {
                    getFeatureFlagByUserAndTeamId() {
                        return false
                    }
                }
            })

            UsersApiService.prototype.getUserProfile = jest.fn(
                (userId: number) => {
                    return Promise.resolve(getUserProfile(userId))
                }
            )

            const mentionData = {
                mention: {
                    id: userId,
                    name: 'Test user'
                }
            }
            const documentOps = getDocumentOps(mentionData)

            Document.findOne = jest.fn(() => {
                return Promise.resolve({
                    id: '1',
                    title: 'Untitled',
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            delta: new Delta(documentOps)
                        })
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([] as DocumentRevision[])
                    },
                    getRevision() {
                        return Promise.resolve({
                            delta: new Delta(getMentionsOps(mentionData))
                        })
                    }
                })
            })

            let req = new RequestResponseMock().request

            let freehandHeaders: FreehandHeaders = {
                ip: '',
                userAgent: '',
                hostname: 'in.local.invision.works'
            }

            let reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                req
            )

            const res = await MentionEmail.create(
                documentId,
                undefined,
                1,
                reducedRequest,
                freehandHeaders
            )
            expect(res).toBeUndefined()
        })

        it("should not send email for users that don't have permissions for the doc", async () => {
            const documentId = '1'
            const userId = 1234

            LaunchDarklyHelper.getInstance = jest.fn(() => {
                return {
                    getFeatureFlagByUserAndTeamId() {
                        return false
                    }
                }
            })

            UsersApiService.prototype.getUserProfile = jest.fn(
                (userId: number) => {
                    return Promise.resolve(getUserProfile(userId))
                }
            )

            const mentionData = {
                mention: {
                    id: userId,
                    name: 'Test user'
                }
            }
            const documentOps = getDocumentOps(mentionData)

            Document.findOne = jest.fn(() => {
                return Promise.resolve({
                    id: '1',
                    title: 'Untitled',
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            delta: new Delta(documentOps)
                        })
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([] as DocumentRevision[])
                    },
                    getRevision() {
                        return Promise.resolve({
                            delta: new Delta(getMentionsOps(mentionData))
                        })
                    }
                })
            })

            let req = new RequestResponseMock().request

            let freehandHeaders: FreehandHeaders = {
                ip: '',
                userAgent: '',
                hostname: 'in.local.invision.works'
            }

            let reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                req
            )

            canSendMentionForDocumentSpy.mockImplementation(async () => false)

            const res = await MentionEmail.create(
                documentId,
                undefined,
                1,
                reducedRequest,
                freehandHeaders
            )

            expect(res).toBeUndefined()
        })

        it('should validate mention delta', () => {
            const notMentionDelta = new Delta([
                {
                    retain: 80
                },
                {
                    attributes: {
                        author: '9'
                    },
                    insert: {
                        'block-embed': {
                            name: 'Test'
                        }
                    }
                }
            ])

            const mentionDelta = new Delta([
                {
                    retain: 80
                },
                {
                    attributes: {
                        author: '9'
                    },
                    insert: {
                        mention: {
                            name: 'Test',
                            id: 1
                        }
                    }
                }
            ])

            const documentMentionDelta = new Delta([
                {
                    retain: 136
                },
                {
                    attributes: {
                        author: '369'
                    },
                    insert: {
                        'document-mention': {
                            documentMention: 'true'
                        }
                    }
                },
                {
                    delete: 4
                }
            ])

            const expectThrowError = (operation: Delta, message: string) => {
                try {
                    MentionEmail.validateMentionDelta(operation)
                } catch (e) {
                    expect(e).toEqual(new Error(message))
                }
            }

            expectThrowError(
                new Delta(),
                'MentionEmail#validateMentionDelta - Invalid mention delta - no operations'
            )
            expectThrowError(
                new Delta([{ retain: 1 }]),
                'MentionEmail#validateMentionDelta - Invalid mention delta - no operations'
            )
            expectThrowError(
                notMentionDelta,
                'MentionEmail#validateMentionDelta - Invalid mention delta - missing mention'
            )

            expectThrowError(
                new Delta([{ retain: 1 }, { delete: 1 }]),
                'MentionEmail#validateMentionDelta - Invalid mention delta - missing insert operation'
            )

            expect(
                MentionEmail.validateMentionDelta(documentMentionDelta)
            ).toEqual({
                retain: 136,
                mention: {
                    documentMention: 'true'
                }
            })

            expect(MentionEmail.validateMentionDelta(mentionDelta)).toEqual({
                retain: 80,
                mention: {
                    id: 1,
                    name: 'Test'
                }
            })
        })
    })
    describe('DocumentUpdateEmail', () => {
        it("should fail if the document can't be found", async () => {
            const documentId = '1'

            Document.findOne = jest.fn(() => {
                return Promise.resolve()
            })

            const freehandHeaders = new FreehandHeadersMock()

            const reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                new RequestResponseMock().request
            )

            try {
                await sendEmail(documentId, 1, reducedRequest, freehandHeaders)
            } catch (e) {
                expect(e).toEqual(
                    new Error('DocumentUpdateEmail#create - Document not found')
                )
            }
        })

        it('should not send document update email when there are no slices', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('\n')
                .insert('\n', { added: true })
                .insert('Third line\n')

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }

            Document.findOne = jest.fn(() => {
                return doc
            })

            EmailerApiService.prototype.batchSendTemplate = jest.fn(() => {
                return Promise.resolve({})
            })

            await sendEmail(
                '1',
                1,
                getReducedRequestFromRequest(new RequestResponseMock().request),
                new FreehandHeadersMock()
            )

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).not.toBeCalled()
        })

        it('should not send document update email when there are not subscribed users', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('First line\n')
                .insert('Modified second line\n', { added: true })
                .insert('Third line\n')

            DocumentMembership.getSubscribedMembers = jest.fn(() => {
                return []
            })

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }

            Document.findOne = jest.fn(() => {
                return doc
            })

            DocumentMembership.findAll = jest.fn(() => {
                return []
            })

            EmailerApiService.prototype.batchSendTemplate = jest.fn(() => {
                return Promise.resolve({})
            })

            await sendEmail(
                '1',
                1,
                getReducedRequestFromRequest(new RequestResponseMock().request),
                new FreehandHeadersMock()
            )

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).not.toBeCalled()
        })

        it('should not send document update email when there is only one user in document', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('First line\n')
                .insert('Modified second line\n', { added: true, author: '1' })
                .insert('Third line\n')

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }

            DocumentRevision.findAll = jest.fn().mockResolvedValue([
                {
                    delta: new Delta()
                        .insert('Title\n')
                        .insert('First line\n')
                        .insert('Modified second line\n', {
                            added: true,
                            author: '1'
                        })
                        .insert('Third line\n'),
                    userId: 1
                }
            ])

            Document.findOne = jest.fn(() => {
                return doc
            })

            DocumentMembership.findAll = jest.fn().mockResolvedValue([
                {
                    userId: 1
                }
            ])

            UsersApiService.prototype.getUserProfilesForAdmin = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 1,
                        teamId: 15,
                        name: 'First Guy',
                        email: 'first@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    }
                ])

            Asset.findAll = jest.fn().mockResolvedValue([])

            EmailerApiService.prototype.batchSendTemplate = jest.fn()

            await sendEmail(
                doc.id,
                1,
                getReducedRequestFromRequest(new RequestResponseMock().request),
                new FreehandHeadersMock()
            )

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).not.toBeCalled()
        })

        it('should exclude user from document update email if he is only one who made the changes', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('First line\n')
                .insert('Modified second line\n', { added: true, author: 1 })
                .insert('Third line\n')

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }

            DocumentRevision.findAll = jest.fn().mockResolvedValue([
                {
                    delta: new Delta()
                        .insert('Title\n')
                        .insert('First line\n')
                        .insert('Modified second line\n', {
                            added: true,
                            author: '1'
                        })
                        .insert('Third line\n'),
                    userId: 1
                }
            ])

            Document.findOne = jest.fn(() => {
                return doc
            })

            DocumentMembership.getSubscribedMembers = jest.fn(() => {
                return [{ userId: 1 }, { userId: 7 }]
            })

            DocumentMembership.findAll = jest.fn().mockResolvedValue([
                {
                    userId: 1,
                    name: 'First guy'
                },
                {
                    userId: 7,
                    name: 'Second guy'
                }
            ])

            UsersApiService.prototype.getUserProfilesForAdmin = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 7,
                        teamId: 15,
                        name: 'Second Guy',
                        email: 'second@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 1,
                        teamId: 15,
                        name: 'First Guy',
                        email: 'first@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    }
                ])

            Asset.findAll = jest.fn().mockResolvedValue([])

            EmailerApiService.prototype.batchSendTemplate = jest
                .fn()
                .mockResolvedValue({})

            const freehandHeaders = new FreehandHeadersMock()

            const reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                new RequestResponseMock().request
            )

            await sendEmail(doc.id, 1, reducedRequest, freehandHeaders)

            expect(
                UsersApiService.prototype.getUserProfilesForAdmin
            ).toBeCalledWith([1, 7], reducedRequest.tracing)

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).toBeCalledWith(
                EmailTemplateType.RhombusDocumentUpdates,
                [
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified second line</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Third line</p>'
                            ]
                        },
                        to: 'second@nowhere.com'
                    }
                ],
                reducedRequest.tracing
            )
        })

        it('should send document update email to all users who made the changes', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('First line\n')
                .insert('Modified', { added: true, author: 1 })
                .insert(' second line\n', { added: true, author: 7 })
                .insert('Third line\n')

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }
            DocumentRevision.findAll = jest.fn().mockResolvedValue([
                {
                    delta: new Delta()
                        .insert('Title\n')
                        .insert('First line\n')
                        .insert('Modified', { added: true, author: 1 }),
                    userId: 1
                },
                {
                    delta: new Delta()
                        .insert(' second line\n', { added: true, author: 7 })
                        .insert('Third line\n'),
                    userId: 7
                }
            ])
            Document.findOne = jest.fn(() => {
                return doc
            })

            DocumentMembership.findAll = jest.fn().mockResolvedValue([
                {
                    userId: 1
                },
                {
                    userId: 7
                }
            ])
            DocumentMembership.getSubscribedMembers = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 1
                    },
                    {
                        userId: 7
                    }
                ])

            UsersApiService.prototype.getUserProfilesForAdmin = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 7,
                        teamId: 15,
                        name: 'Second Guy',
                        email: 'second@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 1,
                        teamId: 15,
                        name: 'First Guy',
                        email: 'first@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    }
                ])

            Asset.findAll = jest.fn().mockResolvedValue([])

            EmailerApiService.prototype.batchSendTemplate = jest
                .fn()
                .mockResolvedValue({})

            const freehandHeaders = new FreehandHeadersMock()

            const reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                new RequestResponseMock().request
            )

            await sendEmail(doc.id, 1, reducedRequest, freehandHeaders)

            expect(
                UsersApiService.prototype.getUserProfilesForAdmin
            ).toBeCalledWith([1, 7], reducedRequest.tracing)

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).toBeCalledWith(
                EmailTemplateType.RhombusDocumentUpdates,
                [
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b> and <b>Second Guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> second line</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Third line</p>'
                            ]
                        },
                        to: 'second@nowhere.com'
                    },
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b> and <b>Second Guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> second line</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Third line</p>'
                            ]
                        },
                        to: 'first@nowhere.com'
                    }
                ],
                reducedRequest.tracing
            )
        })

        it('should display updates separated by three or more lines as different slices', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('First line\n')
                .insert('Modified', { added: true, author: 1 })
                .insert(' second line\n', { added: true, author: 7 })
                .insert('Third line\n')
                .insert('Fourth line\n\n\n')
                .insert('Fifth line', { added: true, author: 1 })
                .insert(' with multiple', { added: true, author: 7 })
                .insert(' contributors\n', { added: true, author: 9 })

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }
            DocumentRevision.findAll = jest.fn().mockResolvedValue([
                {
                    delta: new Delta()
                        .insert('Title\n')
                        .insert('First line\n')
                        .insert('Modified', { added: true, author: 1 }),
                    userId: 1
                },
                {
                    delta: new Delta()
                        .insert(' second line\n', { added: true, author: 7 })
                        .insert('Third line\n')
                        .insert('Fourth line\n\n\n'),
                    userId: 7
                },
                {
                    delta: new Delta().insert('Fifth line', {
                        added: true,
                        author: 1
                    }),
                    userId: 1
                },
                {
                    delta: new Delta().insert(' with multiple', {
                        added: true,
                        author: 7
                    }),
                    userId: 7
                },
                {
                    delta: new Delta().insert('contributors\n', {
                        added: true,
                        author: 9
                    }),
                    userId: 9
                }
            ])
            Document.findOne = jest.fn(() => {
                return doc
            })

            DocumentMembership.findAll = jest.fn().mockResolvedValue([
                {
                    userId: 1
                },
                {
                    userId: 7
                },
                {
                    userId: 9
                }
            ])
            DocumentMembership.getSubscribedMembers = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 1
                    },
                    {
                        userId: 7
                    },
                    {
                        userId: 9
                    }
                ])

            UsersApiService.prototype.getUserProfilesForAdmin = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 7,
                        teamId: 15,
                        name: 'Second Guy',
                        email: 'second@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 1,
                        teamId: 15,
                        name: 'First Guy',
                        email: 'first@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 9,
                        teamId: 15,
                        name: 'Third guy',
                        email: 'third@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    }
                ])

            Asset.findAll = jest.fn().mockResolvedValue([])

            EmailerApiService.prototype.batchSendTemplate = jest
                .fn()
                .mockResolvedValue({})

            const freehandHeaders = new FreehandHeadersMock()

            const reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                new RequestResponseMock().request
            )

            await sendEmail(doc.id, 1, reducedRequest, freehandHeaders)

            expect(
                UsersApiService.prototype.getUserProfilesForAdmin
            ).toBeCalledWith([1, 7, 9], reducedRequest.tracing)

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).toBeCalledWith(
                EmailTemplateType.RhombusDocumentUpdates,
                [
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b> and <b>Second Guy</b></p>',
                                '<p>Updates from <b>First Guy</b>, <b>Second Guy</b> and <b>Third guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> second line</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Third line</p>',
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><br style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0;"></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Fifth line</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> with multiple</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> contributors</span></p>'
                            ]
                        },
                        to: 'second@nowhere.com'
                    },
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b> and <b>Second Guy</b></p>',
                                '<p>Updates from <b>First Guy</b>, <b>Second Guy</b> and <b>Third guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> second line</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Third line</p>',
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><br style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0;"></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Fifth line</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> with multiple</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> contributors</span></p>'
                            ]
                        },
                        to: 'first@nowhere.com'
                    },
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b> and <b>Second Guy</b></p>',
                                '<p>Updates from <b>First Guy</b>, <b>Second Guy</b> and <b>Third guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> second line</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Third line</p>',
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><br style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0;"></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Fifth line</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> with multiple</span><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"> contributors</span></p>'
                            ]
                        },
                        to: 'third@nowhere.com'
                    }
                ],
                reducedRequest.tracing
            )
        })

        it('should not factor in comment-only changes for document update emails', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('First line\n')
                .insert('Modified\n', { added: true, author: 1 })
                .insert('Modified again\n', { added: true, author: 1 })
                .retain(40, { mark: ['cka8krucf00003h6809l30uaa'] })

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }
            DocumentRevision.findAll = jest.fn().mockResolvedValue([
                {
                    delta: new Delta().insert('Modified\n'),
                    userId: 1
                },
                {
                    delta: new Delta().insert('Modified again'),
                    userId: 1
                },
                {
                    userId: 7,
                    delta: new Delta().retain(40, {
                        mark: ['cka8krucf00003h6809l30uaa']
                    })
                }
            ])
            Document.findOne = jest.fn(() => {
                return doc
            })

            DocumentMembership.findAll = jest.fn().mockResolvedValue([
                {
                    userId: 2
                },
                {
                    userId: 1
                },
                {
                    userId: 7
                }
            ])
            DocumentMembership.getSubscribedMembers = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 2
                    },
                    {
                        userId: 1
                    },
                    {
                        userId: 7
                    }
                ])

            UsersApiService.prototype.getUserProfilesForAdmin = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 2,
                        teamId: 15,
                        name: 'Second Guy',
                        email: 'second@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 1,
                        teamId: 15,
                        name: 'First Guy',
                        email: 'first@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 7,
                        teamId: 15,
                        name: 'Third Guy',
                        email: 'third@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    }
                ])

            Asset.findAll = jest.fn().mockResolvedValue([])

            EmailerApiService.prototype.batchSendTemplate = jest.fn()

            const freehandHeaders = new FreehandHeadersMock()

            const reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                new RequestResponseMock().request
            )

            await sendEmail(doc.id, 1, reducedRequest, freehandHeaders)

            // User 1 was the only one to make changes; only the other two should get emails
            expect(
                UsersApiService.prototype.getUserProfilesForAdmin
            ).toBeCalledWith([2, 1, 7], reducedRequest.tracing)

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).toBeCalledWith(
                EmailTemplateType.RhombusDocumentUpdates,
                [
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified again</span></p>'
                            ]
                        },
                        to: 'second@nowhere.com'
                    },
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">First line</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified again</span></p>'
                            ]
                        },
                        to: 'third@nowhere.com'
                    }
                ],
                reducedRequest.tracing
            )
        })

        it('should not include deletion changes in document update emails', async () => {
            const delta = new Delta()
                .insert('Title\n')
                .insert('Modified\n', { added: true, author: 1 })

            const doc = getDocumentRecord()
            doc.getDiff = () => {
                return delta
            }
            DocumentRevision.findAll = jest.fn().mockResolvedValue([
                {
                    userId: 1,
                    delta: new Delta().insert('First Line\n', {
                        added: true,
                        author: 1
                    })
                },
                {
                    userId: 7,
                    delta: new Delta().delete(11)
                },
                {
                    userId: 1,
                    delta: new Delta().insert('Modified\n', {
                        added: true,
                        author: 1
                    })
                }
            ])
            Document.findOne = jest.fn(() => {
                return doc
            })

            DocumentMembership.findAll = jest.fn().mockResolvedValue([
                {
                    userId: 2
                },
                {
                    userId: 1
                },
                {
                    userId: 7
                }
            ])
            DocumentMembership.getSubscribedMembers = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 2
                    },
                    {
                        userId: 1
                    },
                    {
                        userId: 7
                    }
                ])

            UsersApiService.prototype.getUserProfilesForAdmin = jest
                .fn()
                .mockResolvedValue([
                    {
                        userId: 2,
                        teamId: 15,
                        name: 'Second Guy',
                        email: 'second@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 1,
                        teamId: 15,
                        name: 'First Guy',
                        email: 'first@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    },
                    {
                        userId: 7,
                        teamId: 15,
                        name: 'Third Guy',
                        email: 'third@nowhere.com',
                        avatarId: 'aabbcc',
                        avatarUrl: 'http://google.com'
                    }
                ])

            Asset.findAll = jest.fn().mockResolvedValue([])

            EmailerApiService.prototype.batchSendTemplate = jest
                .fn()
                .mockResolvedValue({})

            const freehandHeaders = new FreehandHeadersMock()

            const reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                new RequestResponseMock().request
            )

            await sendEmail(doc.id, 1, reducedRequest, freehandHeaders)

            expect(
                UsersApiService.prototype.getUserProfilesForAdmin
            ).toBeCalledWith([2, 1, 7], reducedRequest.tracing)

            expect(
                EmailerApiService.prototype.batchSendTemplate
            ).toBeCalledWith(
                EmailTemplateType.RhombusDocumentUpdates,
                [
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span></p>'
                            ]
                        },
                        to: 'second@nowhere.com'
                    },
                    {
                        from: 'InVision App <no-reply@invisionapp.com>',
                        subject: "What's new in “Untitled”",
                        templateVariables: {
                            authorship: [
                                '<p>Updates from <b>First Guy</b></p>'
                            ],
                            document_title: 'Untitled',
                            document_url:
                                'https://X_FORWARDED_HOST/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN',
                            updates: [
                                '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">Modified</span></p>'
                            ]
                        },
                        to: 'third@nowhere.com'
                    }
                ],
                reducedRequest.tracing
            )
        })
    })
})
