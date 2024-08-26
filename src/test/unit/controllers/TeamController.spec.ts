import * as chai from 'chai'
import * as sinon from 'sinon'
import { Request, Response } from 'express'
import { Sequelize } from 'sequelize-typescript'
import { Logger } from '../../../util/Logger'
import { TeamController } from '../../../controllers/Team/Controller'
import { Document } from '../../../models/Document'
import { assertFirstCallArgs, RequestResponseMock } from '../../utils'
import { DocumentMembership } from '../../../models/DocumentMembership'
import { getDocumentRecord, getDocumentResponse } from './utils'
import AssetsApiService from '../../../services/AssetsApiService'

describe('TeamController', () => {
    let sandbox = sinon.createSandbox()
    let controller: TeamController

    beforeEach(() => {
        controller = new TeamController()
        sandbox.stub(Logger, 'error')
    })

    afterEach(() => {
        sandbox.restore()
    })

    describe('GetTeamDocuments', () => {
        it('should return team documents', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    teamId: '123'
                },
                pagination: {
                    offset: 0,
                    limit: 500
                }
            })

            const documentRecord = getDocumentRecord()
            const documentResponse = getDocumentResponse(documentRecord)

            Document.findAll = jest.fn(() => {
                return [documentRecord]
            })

            await controller.GetTeamDocuments(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(Document.findAll).toHaveBeenCalledWith({
                limit: 500,
                offset: 0,
                where: {
                    teamId: '123'
                },
                include: [
                    {
                        model: DocumentMembership,
                        attributes: ['userId', 'lastViewed']
                    }
                ]
            })
            expect(requestResponseMock.responseBody).toEqual({
                documents: [documentResponse]
            })
        })

        it('should return archived team documents', async () => {
            const requestResponseMock = new RequestResponseMock({
                query: {
                    isArchived: true
                },
                params: {
                    teamId: '123'
                },
                pagination: {
                    offset: 0,
                    limit: 500
                }
            })

            const documentRecord = getDocumentRecord()
            const documentResponse = getDocumentResponse(documentRecord)

            Document.scope = jest.fn(() => {
                return Document
            })

            Document.findAll = jest.fn(() => {
                return [documentRecord]
            })

            await controller.GetTeamDocuments(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(Document.scope).toBeCalledWith('archived')
            expect(requestResponseMock.responseBody).toEqual({
                documents: [documentResponse]
            })
        })

        it('should return team documents with thumbnails', (done) => {
            const thumbnailAssetKey = 'thumbnail-asset-key'
            const thumbnailUrl = 'thumbnail/path'
            const mockAssetResponse = [
                {
                    path: thumbnailUrl,
                    createdAt: '2018-09-05 09:56:37',
                    companyId: '0',
                    content_type: 'image/png',
                    s3_key: 'thumbnail-s3-key',
                    uploadedAt: '2018-09-05 09:57:54',
                    s3_bucket: 'thumbnail.s3.bucket',
                    assetKey: thumbnailAssetKey,
                    url: thumbnailUrl,
                    content_length: 30845
                }
            ]
            sandbox
                .stub(AssetsApiService.prototype, 'getUrls')
                .returns(mockAssetResponse)
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
                    teamId: '123'
                },
                query: {
                    includeThumbnails: true
                },
                pagination: {
                    offset: 0,
                    limit: 500
                },
                tracing: {}
            }

            let documentRecord = getDocumentRecord()
            documentRecord = {
                ...documentRecord,
                thumbnailAssetKey,
                toJSON: () => {
                    return {
                        ...documentRecord,
                        thumbnailAssetKey
                    }
                }
            }
            let documentResponse = getDocumentResponse(documentRecord)
            documentResponse = {
                ...documentResponse,
                thumbnailUrl
            }

            const findAllCall = sandbox
                .stub(Document, 'findAll')
                .returns([documentRecord])

            controller
                .GetTeamDocuments(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    assertFirstCallArgs(findAllCall, {
                        limit: 500,
                        offset: 0,
                        where: {
                            teamId: '123'
                        },
                        include: [
                            {
                                model: DocumentMembership,
                                attributes: ['userId', 'lastViewed']
                            }
                        ]
                    })
                    chai.expect(JSON.stringify(response)).to.deep.equals(
                        JSON.stringify({
                            documents: [documentResponse]
                        })
                    )
                    done()
                })
                .catch((err: any) => {
                    done(err)
                })
        })
        it('should return filtered team documents by string documentIds', (done) => {
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
                    teamId: '123'
                },
                query: {
                    documentIds: '123,234'
                },
                pagination: {
                    offset: 0,
                    limit: 500
                },
                tracing: {}
            }

            const documentRecord = getDocumentRecord()
            const documentResponse = getDocumentResponse(documentRecord)

            const findAllCall = sandbox
                .stub(Document, 'findAll')
                .returns([documentRecord])

            controller
                .GetTeamDocuments(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    assertFirstCallArgs(findAllCall, {
                        limit: 500,
                        offset: 0,
                        where: {
                            teamId: '123',
                            id: { [Sequelize.Op.in]: ['123', '234'] }
                        },
                        include: [
                            {
                                model: DocumentMembership,
                                attributes: ['userId', 'lastViewed']
                            }
                        ]
                    })
                    chai.expect(response).to.deep.equals({
                        documents: [documentResponse]
                    })
                    done()
                })
                .catch((err: any) => {
                    done(err)
                })
        })

        it('should return filtered team documents by array documentIds', (done) => {
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
                    teamId: '123'
                },
                query: {
                    documentIds: ['123', '234']
                },
                pagination: {
                    offset: 0,
                    limit: 500
                },
                tracing: {}
            }

            const documentRecord = getDocumentRecord()
            const documentResponse = getDocumentResponse(documentRecord)

            const findAllCall = sandbox
                .stub(Document, 'findAll')
                .returns([documentRecord])

            controller
                .GetTeamDocuments(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    assertFirstCallArgs(findAllCall, {
                        limit: 500,
                        offset: 0,
                        where: {
                            teamId: '123',
                            id: { [Sequelize.Op.in]: ['123', '234'] }
                        },
                        include: [
                            {
                                model: DocumentMembership,
                                attributes: ['userId', 'lastViewed']
                            }
                        ]
                    })
                    chai.expect(response).to.deep.equals({
                        documents: [documentResponse]
                    })
                    done()
                })
                .catch((err: any) => {
                    done(err)
                })
        })
    })

    describe('GetUserDocuments', () => {
        it('should return user documents', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    userId: 1,
                    teamId: '123'
                },
                pagination: {
                    offset: 0,
                    limit: 500
                }
            })

            const documentRecord = getDocumentRecord()
            const documentResponse = getDocumentResponse(documentRecord)

            Document.findAll = jest.fn(() => {
                return [documentRecord]
            })

            await controller.GetUserDocuments(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(Document.findAll).toHaveBeenCalledWith({
                limit: 500,
                offset: 0,
                where: {
                    teamId: '123'
                },
                include: [
                    {
                        model: DocumentMembership,
                        attributes: ['userId', 'lastViewed'],
                        where: {
                            userId: 1
                        }
                    }
                ]
            })
            expect(requestResponseMock.responseBody).toEqual({
                documents: [documentResponse]
            })
        })

        it('should return archived user documents', async () => {
            const requestResponseMock = new RequestResponseMock({
                query: {
                    isArchived: true
                },
                params: {
                    userId: 1,
                    teamId: '123'
                },
                pagination: {
                    offset: 0,
                    limit: 500
                }
            })

            const documentRecord = getDocumentRecord()
            const documentResponse = getDocumentResponse(documentRecord)

            Document.scope = jest.fn(() => {
                return Document
            })

            Document.findAll = jest.fn(() => {
                return [documentRecord]
            })

            await controller.GetUserDocuments(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(Document.scope).toBeCalledWith('archived')
            expect(requestResponseMock.responseBody).toEqual({
                documents: [documentResponse]
            })
        })

        it('should return user documents with thumbnails', (done) => {
            const thumbnailAssetKey = 'thumbnail-asset-key'
            const thumbnailUrl = 'thumbnail/path'
            const mockAssetResponse = [
                {
                    path: thumbnailUrl,
                    createdAt: '2018-09-05 09:56:37',
                    companyId: '0',
                    content_type: 'image/png',
                    s3_key: 'thumbnail-s3-key',
                    uploadedAt: '2018-09-05 09:57:54',
                    s3_bucket: 'thumbnail.s3.bucket',
                    assetKey: thumbnailAssetKey,
                    url: thumbnailUrl,
                    content_length: 30845
                }
            ]
            sandbox
                .stub(AssetsApiService.prototype, 'getUrls')
                .returns(mockAssetResponse)
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
                    teamId: '123',
                    userId: 1
                },
                query: {
                    includeThumbnails: true
                },
                pagination: {
                    offset: 0,
                    limit: 500
                },
                tracing: {}
            }

            let documentRecord = getDocumentRecord()
            documentRecord = {
                ...documentRecord,
                thumbnailAssetKey,
                toJSON: () => {
                    return {
                        ...documentRecord,
                        thumbnailAssetKey
                    }
                }
            }
            let documentResponse = getDocumentResponse(documentRecord)
            documentResponse = {
                ...documentResponse,
                thumbnailUrl
            }
            const findAllCall = sandbox
                .stub(Document, 'findAll')
                .returns([documentRecord])

            controller
                .GetUserDocuments(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    assertFirstCallArgs(findAllCall, {
                        limit: 500,
                        offset: 0,
                        where: {
                            teamId: '123'
                        },
                        include: [
                            {
                                model: DocumentMembership,
                                attributes: ['userId', 'lastViewed'],
                                where: {
                                    userId: 1
                                }
                            }
                        ]
                    })
                    chai.expect(response).to.deep.equals({
                        documents: [documentResponse]
                    })
                    done()
                })
                .catch((err: any) => {
                    done(err)
                })
        })
    })
})
