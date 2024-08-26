import * as chai from 'chai'
import { Request, Response } from 'express'
import { noop } from 'lodash'
import * as Delta from 'quill-delta'
import * as sinon from 'sinon'
import { PERMISSION_TYPES } from '../../../constants/AccessSettings'
import {
    DEFAULT_REVISION_METRICS,
    DocumentController
} from '../../../controllers/Document/Controller'
import { Permissions, PermissionsError } from '../../../middleware/Permissions'
import { Document } from '../../../models/Document'
import { DocumentMembership } from '../../../models/DocumentMembership'
import { DocumentRevision } from '../../../models/DocumentRevision'
import AssetsApiService from '../../../services/AssetsApiService'
import DomainService from '../../../services/DomainService'
import { IndexApiService } from '../../../services/IndexApiService'
import { UsersApiService } from '../../../services/UsersApiService'
import { LaunchDarklyHelper } from '../../../util/LaunchDarklyHelper'
import { Logger } from '../../../util/Logger'
import { QueueTaskPusher } from '../../../util/QueueManager'
import { QuillDeltaConverter } from '../../../util/QuillDeltaConverter'
import SocketManager from '../../../util/SocketManager'
import {
    assertFirstCallArgs,
    MockRequest,
    RequestResponseMock
} from '../../utils'
import { getRevisions, getRevisionsComposedDelta } from '../models/utils'
import {
    getDocumentMembershipRecord,
    getDocumentRecord,
    getDocumentResponse
} from './utils'

const mockTransaction = Symbol('transaction')

jest.mock('../../../util/SequelizeManager', () => {
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

jest.mock('../../../util/SocketManager', () => {
    return {
        default: {
            instance: {
                sendDocumentArchivedEvent: jest.fn(),
                sendDocumentUnArchivedEvent: jest.fn()
            },
            getInstance() {
                return this.instance
            }
        }
    }
})

describe('DocumentController', () => {
    beforeEach(() => {
        Document.unscoped = jest.fn(() => {
            return Document
        })
        jest.spyOn(DomainService.prototype, 'logError').mockImplementation(noop)
    })

    describe('CreateDocument', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
            Permissions.prototype.canCreateDocument = jest.fn(() => {
                return true
            })
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should return a 403 if the user doesnt have permission', (done) => {
            let responseStatusCode = 0
            Permissions.prototype.canCreateDocument = jest.fn(() => {
                responseStatusCode = 403
                throw new PermissionsError('Nope', 'test')
            })

            let mockedResponse: Response = <Response>{
                json: () => {
                    responseStatusCode = 200
                }
            }
            const invision: any = {
                user: {
                    teamId: 'cjcjeoi2w0000rn35c23q98ou',
                    userId: '1',
                    name: '',
                    email: ''
                }
            }
            let mockedRequest: Request = <Request>{
                invision,
                body: {
                    title: 'Test'
                },
                query: {
                    includeContents: true
                },
                permissions: new Permissions(12, '123', MockRequest)
            }
            controller
                .CreateDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    done('should be an error')
                })
                .catch((err) => {
                    chai.expect(responseStatusCode).to.equal(403)
                    done()
                })
        })

        it('should return created document with ownerId and teamId', (done) => {
            let responseStatusCode = 0
            let responseData: any

            let mockedResponse: Response = <Response>{
                json: (data) => {
                    responseStatusCode = 200
                    responseData = JSON.parse(JSON.stringify(data))
                }
            }
            const invision: any = {
                user: {
                    teamId: 'cjcjeoi2w0000rn35c23q98ou',
                    userId: '1',
                    name: '',
                    email: ''
                }
            }

            let mockedRequest: Request = <Request>{
                invision,
                body: {
                    title: 'Test'
                },
                query: {
                    includeContents: true
                },
                permissions: new Permissions(12, '123', MockRequest)
            }

            const createCall = sandbox.stub(Document, 'create').returns({
                id: '1',
                title: 'Test',
                contents: () => {
                    return Promise.resolve({ id: 2 })
                },
                toJSON() {
                    return {
                        id: '1',
                        title: 'Test'
                    }
                }
            })

            const membershipsCall = sandbox
                .stub(DocumentMembership, 'findOrCreate')
                .returns({})

            controller
                .CreateDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    assertFirstCallArgs(
                        createCall,
                        {
                            title: 'Test',
                            ownerId: invision.user.userId,
                            teamId: invision.user.teamId
                        },
                        { transaction: mockTransaction }
                    )
                    expect(membershipsCall.calledOnce).toBeTruthy()
                    chai.expect(responseData).to.deep.equal({
                        success: true,
                        document: {
                            url: '/rhombus/Test-2',
                            id: '1',
                            title: 'Test'
                        },
                        contents: {
                            id: 2
                        }
                    })
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('GetDocumentText', () => {
        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().GetDocumentText(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 403 if the user doesnt have permission', async () => {
            const requestResponseMock = new RequestResponseMock()
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                requestResponseMock.responseStatusCode = 403
                throw new PermissionsError('Permissions Error', 'test')
            })

            const documentRecord = getDocumentRecord()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            try {
                await new DocumentController().GetDocumentText(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
                expect(err.message).toEqual('Permissions Error')
            }
        })

        it('should return document text', async () => {
            const requestResponseMock = new RequestResponseMock()
            const documentRecord = getDocumentRecord()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })

            await new DocumentController().GetDocumentText(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                text:
                    'Untitled\nHello World!\nThis is a document whose text is synced in real time\naaa\naaaa @Doc\naaa @Member V7\nbbb\n\n'
            })
        })
    })

    describe('GetAccessSettings', () => {
        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().GetAccessSettings(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return user document membership', async () => {
            const documentRecord = getDocumentRecord()
            documentRecord.permissions = PERMISSION_TYPES.COMMENT

            const requestResponseMock = new RequestResponseMock({
                documentId: documentRecord.id
            })

            IndexApiService.prototype.GetPermissionsForDocument = jest.fn(
                () => {
                    return {
                        data: {
                            [documentRecord.id]: {}
                        }
                    }
                }
            )

            DocumentMembership.findOne = jest.fn(() => {
                return documentRecord
            })

            Document.findOne = jest.fn(() => {
                return {
                    id: documentRecord.id,
                    visibility: 0,
                    permissions: PERMISSION_TYPES.EDIT
                }
            })

            await new DocumentController().GetAccessSettings(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                visibility: 0,
                permissions: PERMISSION_TYPES.EDIT,
                removeMembers: false
            })
        })

        it('should return default document membership if user isnt a member', async () => {
            const documentRecord = getDocumentRecord()
            documentRecord.permissions = PERMISSION_TYPES.EDIT

            const requestResponseMock = new RequestResponseMock({
                documentId: documentRecord.id
            })

            IndexApiService.prototype.GetPermissionsForDocument = jest.fn(
                () => {
                    return {
                        data: {
                            [documentRecord.id]: {}
                        }
                    }
                }
            )

            DocumentMembership.findOne = jest.fn()

            Document.findOne = jest.fn(() => {
                return {
                    id: documentRecord.id,
                    visibility: 0,
                    permissions: 0
                }
            })

            await new DocumentController().GetAccessSettings(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                visibility: 0,
                permissions: PERMISSION_TYPES.EDIT,
                removeMembers: false
            })
        })

        it('should not allow removing members if a user does not have permissions', async () => {
            const requestResponseMock = new RequestResponseMock()
            const documentRecord = getDocumentRecord()

            DocumentMembership.findOne = jest.fn(() => {
                return
            })

            IndexApiService.prototype.GetPermissionsForDocument = jest.fn(
                () => {
                    return {
                        data: {
                            [documentRecord.id]: {}
                        }
                    }
                }
            )

            Document.findOne = jest.fn(() => {
                return {
                    id: documentRecord.id,
                    visibility: 0,
                    permissions: 0
                }
            })

            await new DocumentController().GetAccessSettings(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                visibility: 0,
                permissions: 0,
                removeMembers: false
            })
        })
    })

    describe('SetAccessSettings', () => {
        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().SetAccessSettings(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should set access settings if document is found in db', async () => {
            const requestResponseMock = new RequestResponseMock({
                body: {
                    visibility: 1,
                    permissions: 1
                }
            })

            const document = {
                visibility: 0,
                permissions: 0,
                save: jest.fn()
            }
            Document.findOne = jest.fn(() => {
                return document
            })

            await new DocumentController().SetAccessSettings(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                visibility: 1,
                permissions: 1
            })
            expect(document.save).toBeCalled()
            expect(document.permissions).toEqual(1)
            expect(document.visibility).toEqual(1)
        })
    })

    describe('AddToMemberships', () => {
        beforeEach(() => {
            Permissions.prototype.canAddMembersToDocument = jest.fn(() => {
                return true
            })
        })

        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().AddMembersToMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 403 user doesnt have permissions', async () => {
            const requestResponseMock = new RequestResponseMock({
                body: {
                    members: [
                        {
                            userId: 1
                        }
                    ]
                },
                params: {
                    documentId: '1'
                }
            })

            Permissions.prototype.canAddMembersToDocument = jest.fn(() => {
                requestResponseMock.responseStatusCode = 403
                throw new PermissionsError('Nope', 'test')
            })

            const document = {}
            Document.findOne = jest.fn(() => {
                return document
            })

            DocumentMembership.findCreateFind = jest.fn(() => {
                return [
                    {
                        userId: 1
                    }
                ]
            })

            LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId = jest.fn(
                () => {
                    return true
                }
            )

            const documentController = new DocumentController()
            documentController.usersApiService.getUserProfile = jest.fn(() => {
                return {
                    email: 'test@invisionapp.com'
                }
            })

            try {
                await documentController.AddMembersToMemberships(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
            }
        })

        it('should add member to document if document is found in db', async () => {
            const requestResponseMock = new RequestResponseMock({
                body: {
                    members: [
                        {
                            userId: 1,
                            permissions: {
                                canEdit: true
                            }
                        }
                    ]
                },
                params: {
                    documentId: '1'
                }
            })

            const document = {
                id: '1'
            }
            Document.findOne = jest.fn(() => {
                return document
            })

            DocumentMembership.findCreateFind = jest.fn(() => {
                return [
                    {
                        userId: 1,
                        permissionsObject() {
                            return {
                                canComment: true,
                                canEdit: false
                            }
                        }
                    },
                    true
                ]
            })

            LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId = jest.fn(
                () => {
                    return true
                }
            )

            const documentController = new DocumentController()
            documentController.usersApiService.getUserProfile = jest.fn(() => {
                return {
                    email: 'test@invisionapp.com'
                }
            })

            await documentController.AddMembersToMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                members: [
                    {
                        userId: 1,
                        permissions: {
                            canComment: true,
                            canEdit: false
                        }
                    }
                ]
            })
            expect(DocumentMembership.findCreateFind).toBeCalledWith({
                where: {
                    userId: 1,
                    documentId: '1'
                },
                defaults: {
                    permissions: PERMISSION_TYPES.EDIT
                }
            })

            expect(
                QueueTaskPusher.getInstance().emitEventBusEvent
            ).toBeCalledWith({
                eventData: {
                    documentId: '1',
                    memberId: 1,
                    teamId: '1'
                },
                type: 'document.participant.added.v1'
            })
        })

        it('should not add member to document if isnt enabled in LD', async () => {
            const requestResponseMock = new RequestResponseMock({
                body: {
                    members: [
                        {
                            userId: 1
                        }
                    ]
                },
                params: {
                    documentId: '1'
                }
            })

            const document = {}
            Document.findOne = jest.fn(() => {
                return document
            })

            DocumentMembership.findCreateFind = jest.fn()

            LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId = jest.fn(
                () => {
                    return false
                }
            )

            const documentController = new DocumentController()
            documentController.usersApiService.getUserProfile = jest.fn(() => {
                return {
                    email: 'test@invisionapp.com'
                }
            })

            await documentController.AddMembersToMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                members: []
            })
            expect(DocumentMembership.findCreateFind).not.toBeCalled()
        })
    })

    describe('UpdateMemberships', () => {
        beforeEach(() => {
            Permissions.prototype.canAddMembersToDocument = jest.fn(() => {
                return true
            })
        })

        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().UpdateMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 404 if user isnt document member', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return {}
            })

            DocumentMembership.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().UpdateMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should 403 if a user doesnt have permission', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return {}
            })

            Permissions.prototype.canAddMembersToDocument = jest.fn(() => {
                requestResponseMock.responseStatusCode = 403
                throw new PermissionsError('Nope', 'test')
            })

            try {
                await new DocumentController().UpdateMemberships(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
            }
        })

        it('should update membership if document and member exist', async () => {
            const memberId = 1
            const documentId = '1'
            const permissions = {
                canEdit: true,
                canComment: false
            }

            const requestResponseMock = new RequestResponseMock({
                params: {
                    memberId,
                    documentId
                },
                body: {
                    permissions: {
                        canEdit: true
                    }
                }
            })

            Document.findOne = jest.fn(() => {
                return {
                    id: documentId
                }
            })

            const documentMembership = {
                permissions: 1,
                userId: memberId,
                save: jest.fn(() => {
                    return Promise.resolve()
                }),
                permissionsObject: () => {
                    return permissions
                }
            }

            DocumentMembership.findOne = jest.fn(() => {
                return documentMembership
            })

            SocketManager.getInstance().sendDocumentPermissionsChanged = jest.fn()

            await new DocumentController().UpdateMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({ success: true })
            expect(DocumentMembership.findOne).toBeCalledWith({
                where: {
                    userId: 1,
                    documentId: '1'
                }
            })
            expect(documentMembership.permissions).toEqual(
                PERMISSION_TYPES.EDIT
            )
            expect(documentMembership.save).toBeCalled()
            expect(
                SocketManager.getInstance().sendDocumentPermissionsChanged
            ).toBeCalledWith(documentId, memberId, permissions)
        })
    })

    describe('RemoveFromMemberships', () => {
        beforeEach(() => {
            Permissions.prototype.canRemoveMembersFromDocument = jest.fn(() => {
                return true
            })
        })

        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().RemoveFromMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 404 if user isnt document member', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return {}
            })

            DocumentMembership.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().RemoveFromMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should 403 if a user doesnt have permission', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    memberId: 1,
                    documentId: '1'
                }
            })

            Document.findOne = jest.fn(() => {
                return {}
            })

            const document = {
                destroy: jest.fn(() => {
                    return Promise.resolve()
                })
            }

            DocumentMembership.findOne = jest.fn(() => {
                return document
            })
            Permissions.prototype.canRemoveMembersFromDocument = jest.fn(() => {
                requestResponseMock.responseStatusCode = 403
                throw new PermissionsError('Nope', 'test')
            })
            try {
                await new DocumentController().RemoveFromMemberships(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
            }
        })

        it('should remove member from document if document and member exist', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    memberId: 1,
                    documentId: '1'
                }
            })

            Document.findOne = jest.fn(() => {
                return {
                    id: '1'
                }
            })

            const document = {
                destroy: jest.fn(() => {
                    return Promise.resolve()
                })
            }

            DocumentMembership.findOne = jest.fn(() => {
                return document
            })

            await new DocumentController().RemoveFromMemberships(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({ success: true })
            expect(DocumentMembership.findOne).toBeCalledWith({
                where: {
                    userId: 1,
                    documentId: '1'
                }
            })
            expect(document.destroy).toBeCalled()

            expect(
                QueueTaskPusher.getInstance().emitEventBusEvent
            ).toBeCalledWith({
                eventData: {
                    documentId: '1',
                    memberId: 1,
                    teamId: '1'
                },
                type: 'document.participant.removed.v1'
            })
        })
    })

    describe('GetDocumentAsGuest', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should return a document if is found in db', (done) => {
            let responseStatusCode = 0
            let response = {}

            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                json: (data) => {
                    responseStatusCode = 200
                    response = data
                }
            }

            let mockedRequest: Request = <Request>{
                params: {
                    assetId: '12356'
                },
                query: {},
                tracing: {}
            }

            const documentRecord = getDocumentRecord()
            documentRecord.contents = () => {
                return {}
            }
            const documentResponse = getDocumentResponse(documentRecord)

            sandbox.stub(Document, 'findOne').returns(documentRecord)

            controller
                .GetDocumentAsGuest(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(response).to.deep.equals({
                        document: documentResponse,
                        success: true
                    })
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('GetDocument', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
            Permissions.prototype.canViewDocument = jest.fn(() => {
                return true
            })
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    id: '1'
                }
            })

            Document.findOne = jest.fn(() => {
                return null
            })

            await controller.GetDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )
            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 403 if a user doesnt have permission', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    id: '12356'
                }
            })

            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                requestResponseMock.response.status(403)
                throw new PermissionsError('Nope', 'Test Error')
            })

            Document.findOne = jest.fn(() => {
                return { id: 5 }
            })
            DocumentMembership.findOne = jest.fn(() => {
                return null
            })

            try {
                await controller.GetDocument(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
                expect(requestResponseMock.responseStatusCode).toEqual(403)
            } catch {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
            }
        })

        it('should not check permissions if the user is a member already', (done) => {
            let checkingMembership = false
            let mockedResponse: Response = <Response>{
                json: (body?: any) => {
                    //
                }
            }
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                checkingMembership = true
                return true
            })
            let mockedRequest: Request = <Request>{
                invision: {
                    user: {
                        userId: 1
                    }
                },
                params: {
                    id: '12356'
                },
                permissions: new Permissions(123, '12345', MockRequest),
                query: { includeContents: false }
            }

            sandbox.stub(Document, 'findOne').returns({
                id: 5,
                title: 'Hello world',
                permissionsObject: () => {}
            })
            sandbox
                .stub(DocumentMembership, 'findOne')
                .returns({ permissionsObject: () => {} })
            sandbox
                .stub(DocumentController.prototype, 'getDocumentResponse')
                .returns({})

            controller
                .GetDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(checkingMembership).to.equal(false)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return a document if is found in db', (done) => {
            let responseStatusCode = 0
            let response = {}

            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                json: (data) => {
                    responseStatusCode = 200
                    response = data
                }
            }

            let mockedRequest: Request = <Request>{
                params: {
                    assetId: '12356'
                },
                query: {
                    includeContents: true
                },
                tracing: {},
                invision: {
                    user: {
                        userId: 123,
                        teamId: '12345'
                    }
                },
                permissions: new Permissions(123, '12345', MockRequest)
            }

            const documentRecord = getDocumentRecord()
            documentRecord.contents = () => {
                return {}
            }

            const documentMembershipRecord = getDocumentMembershipRecord()
            documentMembershipRecord.permissionsObject = () => {
                return {
                    canEdit: true,
                    canComment: false
                }
            }

            const documentResponse = getDocumentResponse(documentRecord)

            sandbox.stub(Document, 'findOne').returns(documentRecord)
            sandbox
                .stub(DocumentMembership, 'findOne')
                .returns(documentMembershipRecord)
            sandbox.stub(DocumentMembership, 'findOrCreate').returns({})

            controller
                .GetDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(response).to.deep.equals({
                        document: documentResponse,
                        success: true,
                        contents: {},
                        permissions: {
                            canEdit: true,
                            canComment: false
                        },
                        isSubscribed: true
                    })
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return a document with memberships', async () => {
            const documentRecord = getDocumentRecord()

            const requestResponseMock = new RequestResponseMock({
                query: {
                    includeMemberships: true
                },
                params: {
                    id: documentRecord.id
                }
            })

            documentRecord.permissionsObject = () => {
                return {
                    canEdit: true,
                    canComment: false
                }
            }
            const documentResponse = getDocumentResponse(documentRecord)

            Document.findOne = jest.fn(() => {
                return documentRecord
            })
            DocumentMembership.findOne = jest.fn(() => {
                return documentRecord
            })

            await new DocumentController().GetDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(Document.findOne).toHaveBeenCalled()
            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                document: documentResponse,
                success: true,
                permissions: {
                    canEdit: true,
                    canComment: false
                },
                isSubscribed: false
            })
        })
        it('should return a document with subscriptions', async () => {
            const documentRecord = getDocumentRecord()

            const requestResponseMock = new RequestResponseMock({
                query: {
                    includeMemberships: true,
                    includeSubscriptions: true
                },
                params: {
                    id: documentRecord.id
                }
            })

            documentRecord.permissionsObject = () => {
                return {
                    canEdit: true,
                    canComment: false
                }
            }
            const documentResponse = getDocumentResponse(documentRecord)

            Document.findOne = jest.fn(() => {
                return documentRecord
            })
            DocumentMembership.findOne = jest.fn(() => {
                return documentRecord
            })

            await new DocumentController().GetDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(Document.findOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: expect.arrayContaining([
                        expect.objectContaining({
                            attributes: ['userId', 'isSubscribed']
                        })
                    ]),
                    where: { id: undefined, teamId: '1' }
                })
            )
            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual({
                document: documentResponse,
                success: true,
                permissions: {
                    canEdit: true,
                    canComment: false
                },
                isSubscribed: false
            })
        })
        it('should return a document without contents and without memberships', async () => {
            const documentRecord = getDocumentRecord()

            const requestResponseMock = new RequestResponseMock({
                params: {
                    id: documentRecord.id
                },
                query: {
                    includeContents: false
                }
            })

            documentRecord.permissionsObject = () => {
                return {
                    canEdit: true,
                    canComment: false
                }
            }
            const documentResponse = getDocumentResponse(documentRecord)

            Document.findOne = jest.fn(() => {
                return documentRecord
            })
            DocumentMembership.findOne = jest.fn(() => {
                return documentRecord
            })

            await controller.GetDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(Document.findOne).toBeCalled()
            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody.contents).toBeUndefined()
            expect(requestResponseMock.responseBody).toEqual({
                document: documentResponse,
                success: true,
                permissions: {
                    canEdit: true,
                    canComment: false
                },
                isSubscribed: false
            })
        })
    })

    describe('GetDocumentHtml', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should return a 404 if document id isnt found', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {
                    //
                }
            }
            let mockedRequest: Request = new RequestResponseMock().request

            sandbox.stub(Document, 'findOne').returns(null)

            controller
                .GetDocumentHtml(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return html correctly', async () => {
            const requestResponseMock = new RequestResponseMock()

            const operation = {
                delta: new Delta()
            }

            const documentStub = {
                contents: () => {
                    return operation
                }
            }

            const html = '<b>Here is some html</b>'

            sandbox.stub(Document, 'findOne').returns(documentStub)
            sandbox.createStubInstance(QuillDeltaConverter)
            sandbox.stub(QuillDeltaConverter.prototype, 'convert').returns(html)

            await controller.GetDocumentHtml(
                requestResponseMock.request,
                requestResponseMock.response
            )
            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual(html)
        })
    })

    describe('GetMemberships', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should return a 404 if the invision userId is invalid', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                }
            }
            let mockedRequest: Request = new RequestResponseMock().request
            delete mockedRequest.invision.user.userId

            sandbox.stub(Document, 'findOne').returns({
                members: () => {
                    return []
                }
            })

            controller
                .GetMemberships(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return a 500 if members and profiles dont match', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                }
            }
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })
            let mockedRequest: Request = <Request>{
                permissions: new Permissions(123, '1234', MockRequest),
                query: {}
            }
            mockedRequest.invision = {
                user: {
                    userId: 12,
                    companyId: 1,
                    teamId: '1',
                    sessionId: '',
                    name: '',
                    email: '',
                    vendorId: ''
                }
            }
            mockedRequest.params = { documentId: 1 }
            mockedRequest.tracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            sandbox.stub(DocumentMembership, 'findCreateFind').returns({})
            sandbox.stub(Document, 'findOne').returns({
                members: () => {
                    return [{ userId: 1 }]
                }
            })
            sandbox
                .stub(UsersApiService.prototype, 'getUserProfiles')
                .returns([])

            controller
                .GetMemberships(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(500)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return a 404 if the document isnt found', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                }
            }
            let mockedRequest: Request = <Request>{}
            mockedRequest.invision = {
                user: {
                    userId: 12,
                    companyId: 1,
                    teamId: '1',
                    sessionId: '',
                    name: '',
                    email: '',
                    vendorId: ''
                }
            }
            mockedRequest.params = { documentId: 1 }

            sandbox.stub(DocumentMembership, 'findCreateFind').returns({})
            sandbox.stub(Document, 'findOne').returns(undefined)

            controller
                .GetMemberships(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return valid json if a member/document is found', (done) => {
            let responseStatusCode = 0
            let responseData = { success: false }
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return {
                        json: (data) => {
                            responseData.success = data.success
                        }
                    }
                }
            }
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })
            let mockedRequest: Request = <Request>{
                permissions: new Permissions(123, '1234', MockRequest)
            }
            mockedRequest.invision = {
                user: {
                    userId: 12,
                    companyId: 1,
                    teamId: '1',
                    sessionId: '',
                    name: '',
                    email: '',
                    vendorId: ''
                }
            }
            mockedRequest.params = { documentId: '1' }
            mockedRequest.tracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            sandbox.stub(DocumentMembership, 'findCreateFind').returns({})

            sandbox.stub(Document, 'findOne').returns({
                members: () => {
                    return []
                }
            })

            controller
                .GetMemberships(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(responseData.success).to.equal(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should not create a membership if the document is invalid', (done) => {
            let responseStatusCode = 0
            let responseData = { success: false }
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return {
                        json: (data) => {
                            responseData.success = data.success
                        }
                    }
                }
            }
            let mockedRequest: Request = <Request>{}
            mockedRequest.invision = {
                user: {
                    userId: 12,
                    companyId: 1,
                    teamId: '1',
                    sessionId: '',
                    name: '',
                    email: '',
                    vendorId: ''
                }
            }
            mockedRequest.params = { documentId: '1' }

            const membershipAdded = sandbox
                .stub(DocumentMembership, 'findCreateFind')
                .returns({})

            sandbox.stub(Document, 'findOne').returns(undefined)

            controller
                .GetMemberships(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    chai.expect(membershipAdded.called).to.equal(false)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should merge members and profiles and sort correctly', (done) => {
            let responseStatusCode = 0
            let response = {
                success: false,
                members: [{ userId: -100, lastViewed: null, email: null }]
            }
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return {
                        json: (data) => {
                            response = data
                        }
                    }
                }
            }
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })
            let mockedRequest: Request = <Request>{
                permissions: new Permissions(123, '1234', MockRequest)
            }
            mockedRequest.invision = {
                user: {
                    userId: 3,
                    companyId: 1,
                    teamId: '1',
                    sessionId: '',
                    name: '',
                    email: '',
                    vendorId: ''
                }
            }
            mockedRequest.params = { documentId: 1 }
            mockedRequest.tracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const viewedDate1 = new Date(50000)
            const viewedDate2 = new Date(10000)
            const viewedDate3 = new Date(30000)

            sandbox.stub(DocumentMembership, 'findCreateFind').returns({})
            sandbox.stub(Document, 'findOne').returns({
                members: () => {
                    return [
                        {
                            userId: 1,
                            lastViewed: viewedDate1,
                            permissionsObject() {
                                return {}
                            }
                        },
                        {
                            userId: 2,
                            lastViewed: viewedDate2,
                            permissionsObject() {
                                return {}
                            }
                        },
                        {
                            userId: 3,
                            lastViewed: viewedDate3,
                            permissionsObject() {
                                return {}
                            }
                        }
                    ]
                }
            })
            sandbox
                .stub(UsersApiService.prototype, 'getUserProfilesForAdmin')
                .returns([
                    { userId: 1, email: 'user1@test.com' },
                    { userId: 2, email: 'user2@test.com' },
                    { userId: 3, email: 'user3@test.com' }
                ])

            controller
                .GetMemberships(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(response.members[0].userId).to.equal(3)
                    chai.expect(response.members[0].lastViewed).to.equal(
                        viewedDate3
                    )
                    chai.expect(response.members[0].email).to.equal(
                        'user3@test.com'
                    )
                    chai.expect(response.members[1].userId).to.equal(1)
                    chai.expect(response.members[1].lastViewed).to.equal(
                        viewedDate1
                    )
                    chai.expect(response.members[1].email).to.equal(
                        'user1@test.com'
                    )
                    chai.expect(response.members[2].userId).to.equal(2)
                    chai.expect(response.members[2].lastViewed).to.equal(
                        viewedDate2
                    )
                    chai.expect(response.members[2].email).to.equal(
                        'user2@test.com'
                    )
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('ArchiveDocument', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
            Permissions.prototype.canArchiveDocument = jest.fn(() => {
                return true
            })
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should archive a document', (done) => {
            let responseStatusCode = 0
            let responseData: any
            const shouldArchive = true
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                json: (data) => {
                    responseStatusCode = 200
                    responseData = JSON.parse(JSON.stringify(data))
                }
            }
            const invision: any = {
                user: {
                    teamId: 'cjcjeoi2w0000rn35c23q98ou',
                    userId: '1',
                    name: '',
                    email: ''
                }
            }

            let mockedRequest: Request = <Request>{
                invision,
                params: {
                    documentId: '12356'
                },
                body: {
                    archive: shouldArchive
                },
                permissions: new Permissions(123, '!2345', MockRequest)
            }

            const documentRecord = getDocumentRecord()
            documentRecord.contents = () => {
                return {}
            }
            documentRecord.save = () => {
                return {}
            }
            sandbox.stub(Document, 'findOne').returns(documentRecord)
            controller
                .ArchiveDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(documentRecord.isArchived).to.equal(
                        shouldArchive
                    )
                    chai.expect(documentRecord.archivedAt).to.be.a('date')
                    chai.expect(responseStatusCode).to.equal(200)
                    expect(
                        SocketManager.getInstance().sendDocumentArchivedEvent
                    ).toBeCalled()
                    chai.expect(responseData).to.deep.equal({
                        success: true
                    })

                    expect(
                        QueueTaskPusher.getInstance().emitEventBusEvent
                    ).toBeCalledWith({
                        eventData: {
                            documentId: 'ccd533e7-d917-4601-b708-9bfea3e26f04',
                            teamId: 'cjcjeoi2w0000rn35c23q98ou'
                        },
                        type: 'document.archived.v1'
                    })

                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return a 403 if a user doesnt have permission', (done) => {
            let responseStatusCode = 0
            const shouldArchive = true
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                json: (data) => {
                    responseStatusCode = 200
                }
            }
            Permissions.prototype.canArchiveDocument = jest.fn(() => {
                mockedResponse.status(403)
                throw new PermissionsError('Nope', 'Test Error')
            })
            const invision: any = {
                user: {
                    teamId: 'cjcjeoi2w0000rn35c23q98ou',
                    userId: '1',
                    name: '',
                    email: ''
                }
            }

            let mockedRequest: Request = <Request>{
                invision,
                query: {},
                params: {
                    documentId: '12356'
                },
                body: {
                    archive: shouldArchive
                },
                permissions: new Permissions(123, '!2345', MockRequest)
            }

            const documentRecord = getDocumentRecord()
            documentRecord.contents = () => {
                return {}
            }
            documentRecord.save = () => {
                return {}
            }
            sandbox.stub(Document, 'findOne').returns(documentRecord)
            controller
                .ArchiveDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    done('Should have thrown an error')
                })
                .catch((err) => {
                    chai.expect(responseStatusCode).to.equal(403)
                    done()
                })
        })

        it('should unarchive a document', (done) => {
            let responseStatusCode = 0
            let responseData: any
            const shouldArchive = false
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                json: (data) => {
                    responseStatusCode = 200
                    responseData = JSON.parse(JSON.stringify(data))
                }
            }
            const invision: any = {
                user: {
                    teamId: 'cjcjeoi2w0000rn35c23q98ou',
                    userId: '1',
                    name: '',
                    email: ''
                }
            }

            let mockedRequest: Request = <Request>{
                invision,
                params: {
                    documentId: '12356'
                },
                body: {
                    archive: shouldArchive
                },
                permissions: new Permissions(123, '!2345', MockRequest)
            }

            const documentRecord = getDocumentRecord()
            documentRecord.contents = () => {
                return {}
            }
            documentRecord.save = () => {
                return {}
            }
            sandbox.stub(Document, 'findOne').returns(documentRecord)
            controller
                .UnarchiveDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(documentRecord.isArchived).to.equal(
                        shouldArchive
                    )
                    chai.expect(documentRecord.archivedAt).to.be.a('null')
                    chai.expect(responseStatusCode).to.equal(200)
                    expect(
                        SocketManager.getInstance().sendDocumentUnArchivedEvent
                    ).toBeCalled()
                    chai.expect(responseData).to.deep.equal({
                        success: true
                    })

                    expect(
                        QueueTaskPusher.getInstance().emitEventBusEvent
                    ).toBeCalledWith({
                        eventData: {
                            documentId: 'ccd533e7-d917-4601-b708-9bfea3e26f04',
                            teamId: 'cjcjeoi2w0000rn35c23q98ou'
                        },
                        type: 'document.restored.v1'
                    })

                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('GetPermissionsForDocuments', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
            Permissions.prototype.canArchiveDocument = jest.fn(() => {
                return true
            })
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should get membership permissions', async () => {
            const requestResponseMock = new RequestResponseMock({
                query: {
                    documentIds: [
                        '11578c44-3f79-4d89-ae74-a1bf9a8832e8',
                        '11578c44-3f79-4d89-ae74-a1bf9a8832e9'
                    ]
                }
            })

            DocumentMembership.findAll = jest.fn(() => {
                return [
                    {
                        documentId: '11578c44-3f79-4d89-ae74-a1bf9a8832e9',
                        permissionsObject: () => {
                            return {
                                canComment: true,
                                canEdit: false
                            }
                        }
                    }
                ]
            })

            await controller.GetPermissionsForDocuments(
                requestResponseMock.request,
                requestResponseMock.response
            )
            expect(requestResponseMock.responseStatusCode).toBe(200)
            expect(requestResponseMock.responseBody).toEqual({
                '11578c44-3f79-4d89-ae74-a1bf9a8832e8': {
                    canComment: false,
                    canEdit: false
                },
                '11578c44-3f79-4d89-ae74-a1bf9a8832e9': {
                    canComment: true,
                    canEdit: false
                }
            })
        })
    })

    describe('GetDocumentThumbnail', () => {
        let sandbox = sinon.createSandbox()
        let controller: DocumentController

        beforeEach(() => {
            controller = new DocumentController()
            sandbox.stub(Logger, 'error')
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should return a 404 if document id isnt found', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {
                    //
                }
            }
            let mockedRequest: Request = new RequestResponseMock().request

            sandbox.stub(Document, 'findOne').returns(null)

            controller
                .GetDocumentThumbnail(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
        it('should return a 404 if the document does not have a thumbnail', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {
                    //
                }
            }
            let mockedRequest: Request = new RequestResponseMock().request

            sandbox.stub(Document, 'findOne').returns({})

            controller
                .GetDocumentThumbnail(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
        it('should return document thumbnail correctly', (done) => {
            let responseStatusCode = 0
            let responseData = ''
            const thumbnailAssetKey = 'thumbnail-asset-key'
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {
                    responseData = body
                }
            }
            let mockedRequest: Request = new RequestResponseMock().request

            const operation = {
                delta: {
                    ops: ''
                }
            }

            const documentStub = {
                thumbnailAssetKey,
                contents: () => {
                    return operation
                }
            }
            const mockAssetResponse = {
                path: '/assets/thumbnail-path',
                createdAt: '2018-09-05 09:56:37',
                companyId: '0',
                content_type: 'image/png',
                s3_key: 'thumbnail-s3-key',
                uploadedAt: '2018-09-05 09:57:54',
                s3_bucket: 'thumbnail.s3.bucket',
                assetKey: thumbnailAssetKey,
                url: 'thumbnail.url',
                content_length: 30845
            }
            sandbox
                .stub(AssetsApiService.prototype, 'getAssetFromAssetKey')
                .returns(mockAssetResponse)
            sandbox.stub(Document, 'findOne').returns(documentStub)
            sandbox.createStubInstance(QuillDeltaConverter)

            controller
                .GetDocumentThumbnail(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(responseData).to.equal(mockAssetResponse)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('Document subscription', () => {
        beforeEach(() => {
            Permissions.prototype.canCommentOnDocument = jest.fn(() => {
                return true
            })
        })

        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().SubscribeToDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 404 if user isnt document member', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return {}
            })

            DocumentMembership.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().SubscribeToDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should 403 if a user doesnt have permission', async () => {
            const requestResponseMock = new RequestResponseMock()

            const documentRecord = getDocumentRecord()
            const documentMembershipRecord = getDocumentMembershipRecord()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            DocumentMembership.findOne = jest.fn(() => {
                return documentMembershipRecord
            })

            Permissions.prototype.canCommentOnDocument = jest.fn(() => {
                requestResponseMock.responseStatusCode = 403
                throw new PermissionsError('Nope', 'test')
            })

            try {
                await new DocumentController().SubscribeToDocument(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
            }
        })

        it('should subscribe to document', async () => {
            const requestResponseMock = new RequestResponseMock()

            const documentRecord = getDocumentRecord()
            const documentMembershipRecord = getDocumentMembershipRecord()
            documentMembershipRecord.isSubscribed = false
            documentMembershipRecord.save = jest.fn()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            DocumentMembership.findOne = jest.fn(() => {
                return documentMembershipRecord
            })

            await new DocumentController().SubscribeToDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(documentMembershipRecord.save).toBeCalled()
            expect(documentMembershipRecord.isSubscribed).toEqual(true)
        })

        it('should unsubscribe from document', async () => {
            const requestResponseMock = new RequestResponseMock()

            const documentRecord = getDocumentRecord()
            const documentMembershipRecord = getDocumentMembershipRecord()
            documentMembershipRecord.save = jest.fn()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            DocumentMembership.findOne = jest.fn(() => {
                return documentMembershipRecord
            })

            await new DocumentController().UnsubscribeFromDocument(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(documentMembershipRecord.save).toBeCalled()
            expect(documentMembershipRecord.isSubscribed).toEqual(false)
        })
    })

    describe('EmitGenericEvent', () => {
        it('should emit an event for the document', async () => {
            const event = 'test-event'
            const documentId = 'iAmADocument'
            const requestResponseMock = new RequestResponseMock({
                body: {
                    event
                },
                params: {
                    documentId
                }
            })

            SocketManager.getInstance().sendGenericEvent = jest.fn()

            await new DocumentController().EmitGenericEvent(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(SocketManager.getInstance().sendGenericEvent).toBeCalledWith(
                event,
                documentId
            )
        })
    })

    describe('GetDocumentRevisions', () => {
        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().GetDocumentRevisions(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 403 if the user doesnt have permission', async () => {
            const requestResponseMock = new RequestResponseMock()
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                requestResponseMock.responseStatusCode = 403
                throw new PermissionsError('Permissions Error', 'test')
            })

            const documentRecord = getDocumentRecord()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            try {
                await new DocumentController().GetDocumentRevisions(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
                expect(err.message).toEqual('Permissions Error')
            }
        })

        it('should return document revisions', async () => {
            const requestResponseMock = new RequestResponseMock()
            const documentRecord = getDocumentRecord()

            LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId = jest.fn(
                () => {
                    return Promise.resolve(DEFAULT_REVISION_METRICS)
                }
            )

            const mockRevisionOne = {
                createdAt: new Date(),
                id: '67475415-c50e-4e76-b2bf-3a6a6ef340af',
                userId: 1,
                revision: 4
            }

            const mockRevisionTwo = {
                createdAt: new Date(),
                id: '3f0c3b97-c3c8-4a60-8fab-e92596c055e1',
                userId: 2,
                revision: 5
            }

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            DocumentRevision.findAll = jest.fn(() => {
                return [mockRevisionOne, mockRevisionTwo]
            })

            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })

            await new DocumentController().GetDocumentRevisions(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual([
                {
                    createdAt: mockRevisionTwo.createdAt,
                    id: mockRevisionTwo.id,
                    revision: mockRevisionTwo.revision,
                    users: [mockRevisionOne.userId, mockRevisionTwo.userId]
                }
            ])
        })
        it('should return separate revert revisions', async () => {
            const requestResponseMock = new RequestResponseMock()
            const documentRecord = getDocumentRecord()

            LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId = jest.fn(
                () => {
                    return Promise.resolve(DEFAULT_REVISION_METRICS)
                }
            )

            const mockRevisionOne = {
                createdAt: new Date(),
                id: '67475415-c50e-4e76-b2bf-3a6a6ef340af',
                userId: 1,
                revision: 4,
                revert: false
            }

            const mockRevisionTwo = {
                createdAt: new Date(),
                id: '3f0c3b97-c3c8-4a60-8fab-e92596c055e1',
                userId: 2,
                revision: 5,
                revert: true
            }

            const mockRevisionThree = {
                createdAt: new Date(),
                id: '1086701c-1d4b-44fd-a833-6c93ff578ad8',
                userId: 1,
                revision: 8,
                revert: false
            }

            const mockRevisionFour = {
                createdAt: new Date(),
                id: '5cf21fd3-79b8-4a06-82f4-8d1d350381a3',
                userId: 2,
                revision: 9,
                revert: false
            }

            const mockRevisionFive = {
                createdAt: new Date(),
                id: 'c633dff9-3774-4873-9605-d46cfaded9f4',
                userId: 3,
                revision: 10,
                revert: false
            }

            const mockRevisionSix = {
                createdAt: new Date(),
                id: 'c4a17bb3-641f-4414-a03a-cb97edad5bc6',
                userId: 2,
                revision: 13,
                revert: true
            }

            const mockRevisionSeven = {
                createdAt: new Date(),
                id: '23bfc999-01da-4915-807a-20843c78173a',
                userId: 2,
                revision: 18,
                revert: false
            }

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            DocumentRevision.findAll = jest.fn(() => {
                return [
                    mockRevisionOne,
                    mockRevisionTwo,
                    mockRevisionThree,
                    mockRevisionFour,
                    mockRevisionFive,
                    mockRevisionSix,
                    mockRevisionSeven
                ]
            })

            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })

            await new DocumentController().GetDocumentRevisions(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual([
                {
                    createdAt: mockRevisionOne.createdAt,
                    id: mockRevisionOne.id,
                    revision: mockRevisionOne.revision,
                    users: [mockRevisionOne.userId],
                    revert: mockRevisionOne.revert
                },
                {
                    createdAt: mockRevisionTwo.createdAt,
                    id: mockRevisionTwo.id,
                    revision: mockRevisionTwo.revision,
                    users: [mockRevisionTwo.userId],
                    revert: mockRevisionTwo.revert
                },
                {
                    createdAt: mockRevisionFive.createdAt,
                    id: mockRevisionFive.id,
                    revision: mockRevisionFive.revision,
                    users: [
                        mockRevisionThree.userId,
                        mockRevisionFour.userId,
                        mockRevisionFive.userId
                    ],
                    revert: mockRevisionFive.revert
                },
                {
                    createdAt: mockRevisionSix.createdAt,
                    id: mockRevisionSix.id,
                    revision: mockRevisionSix.revision,
                    users: [mockRevisionSix.userId],
                    revert: mockRevisionSix.revert
                },
                {
                    createdAt: mockRevisionSeven.createdAt,
                    id: mockRevisionSeven.id,
                    revision: mockRevisionSeven.revision,
                    users: [mockRevisionSeven.userId],
                    revert: mockRevisionSeven.revert
                }
            ])
        })
        it('should return document revisions if launch darkly fails', async () => {
            const requestResponseMock = new RequestResponseMock()
            const documentRecord = getDocumentRecord()

            LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId = jest.fn(
                () => {
                    return Promise.reject()
                }
            )

            const mockRevisionOne = {
                createdAt: new Date(),
                id: '67475415-c50e-4e76-b2bf-3a6a6ef340af',
                userId: 1,
                revision: 4
            }

            const mockRevisionTwo = {
                createdAt: new Date(),
                id: '3f0c3b97-c3c8-4a60-8fab-e92596c055e1',
                userId: 2,
                revision: 5
            }

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            DocumentRevision.findAll = jest.fn(() => {
                return [mockRevisionOne, mockRevisionTwo]
            })

            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })

            await new DocumentController().GetDocumentRevisions(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual([
                {
                    createdAt: mockRevisionTwo.createdAt,
                    id: mockRevisionTwo.id,
                    revision: mockRevisionTwo.revision,
                    users: [mockRevisionOne.userId, mockRevisionTwo.userId]
                }
            ])
        })
    })

    describe('GetDocumentAtRevision', () => {
        it('should return a 404 if document id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock()

            Document.findOne = jest.fn(() => {
                return null
            })

            await new DocumentController().GetDocumentAtRevision(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(404)
        })

        it('should return a 403 if the user doesnt have permission', async () => {
            const requestResponseMock = new RequestResponseMock()
            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                requestResponseMock.responseStatusCode = 403
                throw new PermissionsError('Permissions Error', 'test')
            })

            const documentRecord = getDocumentRecord()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            try {
                await new DocumentController().GetDocumentAtRevision(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(requestResponseMock.responseStatusCode).toEqual(403)
                expect(err.message).toEqual('Permissions Error')
            }
        })

        it('should return document revisions if launch darkly fails', async () => {
            const revisions = getRevisions()
            const lastRevision = revisions[revisions.length - 1]
            const delta = getRevisionsComposedDelta(revisions)

            Document.prototype.contents = jest.fn(() => {
                return {
                    delta,
                    revision: lastRevision.revision
                }
            })

            const requestResponseMock = new RequestResponseMock({
                params: {
                    revision: revisions.length - 1
                }
            })
            const documentRecord = getDocumentRecord()

            Document.findOne = jest.fn(() => {
                return documentRecord
            })

            Permissions.prototype.canJoinAndViewDocument = jest.fn(() => {
                return true
            })

            await new DocumentController().GetDocumentAtRevision(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(
                requestResponseMock.responseBody.contents.delta
            ).toMatchSnapshot()
        })
    })
})
