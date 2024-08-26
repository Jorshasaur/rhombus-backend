import * as chai from 'chai'
import * as sinon from 'sinon'
import { Request, Response } from 'express'
import { Logger } from '../../../util/Logger'
import { AssetController } from '../../../controllers/Asset/Controller'
import { Asset } from '../../../models/Asset'
import { Document } from '../../../models/Document'
import AssetsApiService from '../../../services/AssetsApiService'
import FreehandApiService from '../../../services/FreehandApiService'
import PresentationsApiService from '../../../services/PresentationsApiService'
import { RequestResponseMock } from '../../utils'
import PrototypesApiService from '../../../services/PrototypesApiService'

describe('AssetController', () => {
    let sandbox = sinon.createSandbox()
    let controller: AssetController

    beforeEach(() => {
        controller = new AssetController()
        sandbox.stub(Logger, 'error')
    })

    afterEach(() => {
        sandbox.restore()
    })

    describe('combineResults', () => {
        it('should return correctly combined results', () => {
            const assetRecords = [
                {
                    id: '34e2f6b9-5dd5-4f57-b022-1b3fdb7e4e16',
                    documentId: '2cab40f3-b9d0-49e9-91b3-3662d15e8007',
                    assetKey: '9c61c73d-e54c-45c2-bb4a-7cfd3403086f',
                    fileName: 'DSCF8303.jpg',
                    uploaded: true,
                    createdAt: '2018-02-21T13:36:57.574Z',
                    updatedAt: '2018-02-21T13:37:03.311Z'
                },
                {
                    id: '39aa0bc9-94bd-4662-adad-c9d4558aca8c',
                    documentId: '2cab40f3-b9d0-49e9-91b3-3662d15e8007',
                    assetKey: '361f1194-49e9-4f92-a54e-057adaca8f44',
                    fileName: 'image.png',
                    uploaded: true,
                    createdAt: '2018-02-21T13:37:12.479Z',
                    updatedAt: '2018-02-21T13:37:15.451Z'
                }
            ] as Asset[]

            const assets = [
                {
                    uploadedAt: '2018-02-21 13:37:15.0',
                    assetKey: '361f1194-49e9-4f92-a54e-057adaca8f44',
                    url:
                        'https://assets.local.invision.works/assets/df900ab0-c2ba-4d67-8b15-5840f2facd08',
                    path: '/assets/1382ffc6-a8a0-4673-ba96-97fd87612ecc'
                },
                {
                    uploadedAt: '2018-02-21 13:37:03.0',
                    assetKey: '9c61c73d-e54c-45c2-bb4a-7cfd3403086f',
                    url:
                        'https://assets.local.invision.works/assets/1382ffc6-a8a0-4673-ba96-97fd87612ecc',
                    path: '/assets/1382ffc6-a8a0-4673-ba96-97fd87612ecc'
                }
            ]

            const result = controller.combineResults(assetRecords, assets)
            chai.expect(result).to.deep.equals([
                {
                    fileName: 'image.png',
                    id: '39aa0bc9-94bd-4662-adad-c9d4558aca8c',
                    url:
                        'https://assets.local.invision.works/assets/df900ab0-c2ba-4d67-8b15-5840f2facd08',
                    contentType: undefined,
                    createdAt: '2018-02-21T13:37:12.479Z'
                },
                {
                    fileName: 'DSCF8303.jpg',
                    id: '34e2f6b9-5dd5-4f57-b022-1b3fdb7e4e16',
                    url:
                        'https://assets.local.invision.works/assets/1382ffc6-a8a0-4673-ba96-97fd87612ecc',
                    contentType: undefined,
                    createdAt: '2018-02-21T13:36:57.574Z'
                }
            ])
        })
    })

    describe('ListAssets', () => {
        it('should return document assets if they are found in DB and assets api', (done) => {
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
                    assetId: '12356',
                    documentId: '6AEAF251-D906-4F7C-952D-14A05D033D7D'
                },
                tracing: {}
            }

            const assetRecord = {
                assetKey: 'abc',
                id: '12356',
                fileName: 'test.png',
                createdAt: '2018-02-21T13:36:57.574Z'
            }

            const asset = {
                assetKey: 'abc',
                url: 'http://assets-api/def'
            }
            const assets = [asset]

            sandbox.stub(Asset, 'findAll').returns([assetRecord])

            sandbox.stub(AssetsApiService.prototype, 'getInfo').returns(assets)

            controller
                .ListAssets(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(response).to.deep.equals({
                        assets: [
                            {
                                id: assetRecord.id,
                                fileName: assetRecord.fileName,
                                url: asset.url,
                                contentType: undefined,
                                createdAt: '2018-02-21T13:36:57.574Z'
                            }
                        ]
                    })
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return error if assets api returns error', (done) => {
            let mockedResponse: Response = <Response>{}
            let mockedRequest: Request = <Request>{
                params: {
                    assetId: '12356',
                    documentId: '6AEAF251-D906-4F7C-952D-14A05D033D7D'
                },
                tracing: {}
            }

            const assetRecord = {
                id: '12356',
                fileName: 'test.png'
            }

            sandbox.stub(Asset, 'findAll').returns([assetRecord])

            sandbox.stub(AssetsApiService.prototype, 'getInfo').returns(null)

            controller
                .ListAssets(mockedRequest, mockedResponse)
                .catch((err: Error) => {
                    chai.expect(new Error()).to.be.an('error')
                    chai.expect(err.message).equal(
                        'Unable to get assets from assets api'
                    )
                    done()
                })
        })

        it('should return empty array if there is not asset for document', (done) => {
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
                    assetId: '12356',
                    documentId: '6AEAF251-D906-4F7C-952D-14A05D033D7D'
                },
                tracing: {}
            }

            sandbox.stub(Asset, 'findAll').returns([])

            sandbox.stub(AssetsApiService.prototype, 'getUrls').returns(null)

            controller
                .ListAssets(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(response).to.deep.equals({
                        assets: []
                    })
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('RequestUpload', () => {
        it('should return a list of upload urls', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    documentId: '6AEAF251-D906-4F7C-952D-14A05D033D7D'
                },
                body: {
                    assets: [
                        {
                            fileName: 'test.png'
                        }
                    ]
                }
            })

            const assetRecord = {
                assetKey: 'abc',
                id: '12356',
                fileName: 'test.png',
                createdAt: '2018-02-21T13:36:57.574Z'
            }

            sandbox.stub(Asset, 'bulkCreate').returns([assetRecord])

            const asset = {
                assetKey: 'abc',
                url: 'http://assets-api/def'
            }
            const assets = [asset]

            sandbox
                .stub(AssetsApiService.prototype, 'createAssets')
                .returns(assets)

            await controller.RequestUpload(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(requestResponseMock.responseStatusCode).toBe(200)
            expect(requestResponseMock.responseBody).toEqual({
                assets: [
                    {
                        id: assetRecord.id,
                        fileName: assetRecord.fileName,
                        url: asset.url,
                        contentType: undefined,
                        createdAt: '2018-02-21T13:36:57.574Z'
                    }
                ]
            })
        })

        it('should return error if assets api returns error', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    documentId: '6AEAF251-D906-4F7C-952D-14A05D033D7D'
                },
                body: {
                    assets: [
                        {
                            fileName: 'test.png'
                        }
                    ]
                }
            })

            sandbox
                .stub(AssetsApiService.prototype, 'createAssets')
                .returns(null)

            try {
                await controller.RequestUpload(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (err) {
                expect(err.message).toBe(
                    'Unable to create assets in assets api'
                )
            }
        })
    })

    describe('CopyAsset', () => {
        it('should return a 404 if asset id isnt found', async () => {
            const requestResponseMock = new RequestResponseMock({
                body: {
                    assetId: '1'
                },
                params: {
                    documentId: '1'
                }
            })

            Asset.findOne = jest.fn(() => {
                return null
            })

            await controller.CopyAssetFromId(
                requestResponseMock.request,
                requestResponseMock.response
            )
            expect(requestResponseMock.responseStatusCode).toEqual(404)
            expect(requestResponseMock.responseBody).toEqual({
                message: 'Asset not found'
            })
        })

        it('should return a 404 if document isnt found', async () => {
            const requestResponseMock = new RequestResponseMock({
                body: {
                    assetId: '1'
                },
                params: {
                    documentId: '1'
                }
            })

            Asset.findOne = jest.fn(() => {
                return {}
            })

            Document.findById = jest.fn(() => {
                return null
            })

            await controller.CopyAssetFromId(
                requestResponseMock.request,
                requestResponseMock.response
            )
            expect(requestResponseMock.responseStatusCode).toEqual(404)
            expect(requestResponseMock.responseBody).toEqual({
                message: 'Document not found'
            })
        })

        it('should check if user has permissions', async () => {
            const requestResponseMock = new RequestResponseMock({
                body: {
                    assetId: '1'
                },
                params: {
                    documentId: '1'
                }
            })

            Asset.findOne = jest.fn(() => {
                return {}
            })

            Document.findById = jest.fn(() => {
                return {}
            })

            try {
                await controller.CopyAssetFromId(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (e) {
                expect(e.name).toEqual('Permissions Error')
            }
        })

        it('should copy asset', async () => {
            const documentId = '1'

            const requestResponseMock = new RequestResponseMock({
                body: {
                    assetId: '1'
                },
                params: {
                    documentId
                }
            })
            requestResponseMock.request.permissions.canJoinAndViewDocument = jest.fn(
                () => {
                    return true
                }
            )

            const assetRecord = {
                assetKey: 'copy-asset',
                documentId: '2',
                fileName: 'text.txt'
            }

            const newAsset = {
                assetKey: 'new-asset',
                url: 'http://new-asset'
            }

            const newAssetRecord = {
                id: 'new-asset-id',
                assetKey: newAsset.assetKey,
                fileName: assetRecord.fileName,
                createdAt: '2018-02-21T13:36:57.574Z'
            }

            Asset.findOne = jest.fn(() => {
                return assetRecord
            })

            Asset.create = jest.fn(() => {
                return newAssetRecord
            })

            Document.findById = jest.fn(() => {
                return {}
            })

            AssetsApiService.prototype.copyAsset = jest.fn(() => {
                return newAsset
            })

            await controller.CopyAssetFromId(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(AssetsApiService.prototype.copyAsset).toBeCalledWith(
                assetRecord.assetKey,
                requestResponseMock.request.tracing
            )
            expect(Asset.create).toBeCalledWith({
                documentId,
                assetKey: newAsset.assetKey,
                fileName: assetRecord.fileName,
                uploaded: true
            })
            expect(requestResponseMock.responseStatusCode).toBe(200)
            expect(requestResponseMock.responseBody).toEqual({
                id: newAssetRecord.id,
                url: newAsset.url,
                fileName: newAssetRecord.fileName,
                createdAt: newAssetRecord.createdAt
            })
        })

        it('should not copy asset in same doc', async () => {
            const documentId = '1'

            const requestResponseMock = new RequestResponseMock({
                body: {
                    assetId: '1'
                },
                params: {
                    documentId
                }
            })

            const assetRecord = {
                assetKey: 'copy-asset',
                documentId,
                fileName: 'text.txt'
            }

            Asset.findOne = jest.fn(() => {
                return assetRecord
            })

            requestResponseMock.request.permissions.canJoinAndViewDocument = jest.fn(
                () => {
                    return true
                }
            )
            Document.findById = jest.fn(() => {
                return {}
            })

            controller.fetchAsset = jest.fn()

            await controller.CopyAssetFromId(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(controller.fetchAsset).toBeCalled()
        })

        it('should copy asset from url', async () => {
            const documentId = '1'

            const requestResponseMock = new RequestResponseMock({
                body: {
                    assetUrl: 'asset-url'
                },
                params: {
                    documentId
                }
            })
            requestResponseMock.request.permissions.canJoinAndViewDocument = jest.fn(
                () => {
                    return true
                }
            )

            const assetRecord = {
                assetKey: 'copy-asset',
                documentId: '2',
                fileName: 'text.txt'
            }

            const newAsset = {
                assetKey: 'new-asset',
                url: 'http://new-asset'
            }

            const newAssetRecord = {
                id: 'new-asset-id',
                assetKey: newAsset.assetKey,
                fileName: assetRecord.fileName,
                createdAt: '2018-02-21T13:36:57.574Z'
            }

            AssetsApiService.prototype.getAssetFromUrl = jest.fn(() => {
                return assetRecord
            })

            Asset.findOne = jest.fn(() => {
                return assetRecord
            })

            Asset.create = jest.fn(() => {
                return newAssetRecord
            })

            Document.findById = jest.fn(() => {
                return {}
            })

            AssetsApiService.prototype.copyAsset = jest.fn(() => {
                return newAsset
            })

            await controller.CopyAssetFromUrl(
                requestResponseMock.request,
                requestResponseMock.response
            )

            expect(AssetsApiService.prototype.copyAsset).toBeCalledWith(
                assetRecord.assetKey,
                requestResponseMock.request.tracing
            )
            expect(Asset.create).toBeCalledWith({
                documentId,
                assetKey: newAsset.assetKey,
                fileName: assetRecord.fileName,
                uploaded: true
            })
            expect(requestResponseMock.responseStatusCode).toBe(200)
            expect(requestResponseMock.responseBody).toEqual({
                id: newAssetRecord.id,
                url: newAsset.url,
                fileName: newAssetRecord.fileName,
                createdAt: newAssetRecord.createdAt
            })
        })
    })

    describe('GetAsset', () => {
        it('should return a 404 if asset id isnt found', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {}
            }
            let mockedRequest: Request = <Request>{
                params: {
                    assetId: '12356'
                },
                tracing: {}
            }

            sandbox.stub(Asset, 'findOne').returns(null)

            controller
                .GetAsset(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return a 404 if asset isnt found on assets api', (done) => {
            let responseStatusCode = 0

            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {}
            }
            let mockedRequest: Request = <Request>{
                params: {
                    assetId: '12356'
                },
                tracing: {}
            }

            sandbox.stub(Asset, 'findOne').returns({ assetKey: 'abc' })

            sandbox.stub(AssetsApiService.prototype, 'getUrls').returns([])

            controller
                .GetAsset(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(404)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return error if assets api returns error', async () => {
            const requestResponseMock = new RequestResponseMock({
                params: {
                    assetId: '12356'
                }
            })

            Asset.findOne = jest.fn(() => {
                return { assetKey: 'abc' }
            })
            AssetsApiService.prototype.getUrls = jest.fn(() => {
                return null
            })

            try {
                controller.GetAsset(
                    requestResponseMock.request,
                    requestResponseMock.response
                )
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toEqual(
                    'should return error if assets api returns error'
                )
            }
        })

        it('should return a asset if is found in db and assets api', (done) => {
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
                tracing: {}
            }

            const assetRecord = {
                id: '12356',
                assetKey: 'abc',
                fileName: 'abc.png',
                createdAt: '2018-02-21T13:36:57.574Z'
            }
            sandbox.stub(Asset, 'findOne').returns(assetRecord)

            const url = 'http://assets-api/def'

            sandbox
                .stub(AssetsApiService.prototype, 'getUrls')
                .returns([{ url }])

            controller
                .GetAsset(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(200)
                    chai.expect(response).to.deep.equals({
                        id: assetRecord.id,
                        fileName: assetRecord.fileName,
                        url,
                        createdAt: assetRecord.createdAt
                    })
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })
    describe('Get remote document', () => {
        it('should return 400 if missing service', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {}
            }
            let mockedRequest: Request = <Request>{
                params: {
                    serviceAssetId: '12356'
                },
                tracing: {}
            }
            mockedRequest.headers = {
                'x-forwarded-for': '0.0.0.0',
                'user-agent': 'Chrome'
            }
            controller
                .GetExternalDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(400)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
        it('should return 400 if missing serviceAssetId', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {}
            }
            let mockedRequest: Request = <Request>{
                params: {
                    service: 'freehand-private'
                },
                tracing: {}
            }
            mockedRequest.headers = {
                'x-forwarded-for': '0.0.0.0',
                'user-agent': 'Chrome'
            }
            controller
                .GetExternalDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(400)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
        it('should return 400 if missing user-agent in request headers', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {}
            }
            let mockedRequest: Request = <Request>{
                params: {
                    service: 'freehand-private',
                    serviceAssetId: '12356'
                },
                tracing: {}
            }
            mockedRequest.headers = { 'x-forwarded-for': '0.0.0.0' }
            controller
                .GetExternalDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(400)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })

        it('should return 400 if missing x-forwarded-for in request headers for Freehands', (done) => {
            let responseStatusCode = 0
            let mockedResponse: Response = <Response>{
                status: (code: number) => {
                    responseStatusCode = code
                    return mockedResponse
                },
                send: (body?: any) => {}
            }
            let mockedRequest: Request = <Request>{
                params: {
                    service: 'freehand-private',
                    serviceAssetId: '12356'
                },
                tracing: {}
            }
            mockedRequest.headers = { 'user-agent': 'Chrome' }
            controller
                .GetExternalDocument(mockedRequest, mockedResponse)
                .then((result) => {
                    chai.expect(responseStatusCode).to.equal(400)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    it('should return 400 if missing user-agent in request headers Freehand', (done) => {
        let responseStatusCode = 0
        let mockedResponse: Response = <Response>{
            status: (code: number) => {
                responseStatusCode = code
                return mockedResponse
            },
            send: (body?: any) => {}
        }
        let mockedRequest: Request = <Request>{
            params: {
                service: 'freehand-private',
                serviceAssetId: '12356'
            },
            tracing: {}
        }
        mockedRequest.headers = { 'x-forwarded-for': '0.0.0.0' }
        controller
            .GetExternalDocument(mockedRequest, mockedResponse)
            .then((result) => {
                chai.expect(responseStatusCode).to.equal(400)
                done()
            })
            .catch((err) => {
                done(err)
            })
    })
    it('should get a private freehand', (done) => {
        const host = 'mythumbnailhost.com'
        const thumbnailUrl = '/thumbnail'
        const updatedAt = 'The past!'
        sandbox
            .stub(FreehandApiService.prototype, 'getFreehand')
            .returns({ thumbnailUrl, updatedAt })

        let responseStatusCode = 0
        let response = {}

        let mockedResponse: Response = <Response>{
            send: (body?: any) => {
                return
            },
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
                service: 'freehand-private',
                serviceAssetId: '12356'
            },
            tracing: {}
        }
        mockedRequest.headers = {
            'x-forwarded-for': '0.0.0.0',
            'user-agent': 'Chrome',
            'x-forwarded-host': host
        }
        controller
            .GetExternalDocument(mockedRequest, mockedResponse)
            .then((result) => {
                chai.expect(responseStatusCode).to.equal(200)
                chai.expect(response).to.deep.equals({
                    externalDocument: {
                        thumbnailUrl: '//' + host + thumbnailUrl,
                        updatedAt: updatedAt
                    }
                })
                done()
            })
            .catch((err) => {
                done(err)
            })
    })
    it('should get a public freehand', (done) => {
        const host = 'mythumbnailhost.com'
        const thumbnailUrl = '/thumbnail'
        sandbox
            .stub(FreehandApiService.prototype, 'getFreehand')
            .returns({ thumbnailUrl })

        let responseStatusCode = 0
        let response = {}

        let mockedResponse: Response = <Response>{
            send: (body?: any) => {},
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
                service: 'freehand-public',
                serviceAssetId: '12356'
            },
            tracing: {}
        }
        mockedRequest.headers = {
            'x-forwarded-for': '0.0.0.0',
            'user-agent': 'Chrome',
            'x-forwarded-host': host
        }
        controller
            .GetExternalDocument(mockedRequest, mockedResponse)
            .then((result) => {
                chai.expect(responseStatusCode).to.equal(200)
                chai.expect(response).to.deep.equals({
                    externalDocument: {
                        thumbnailUrl: '//' + host + thumbnailUrl
                    }
                })
                done()
            })
            .catch((err) => {
                done(err)
            })
    })
    it('should get a presentation document', (done) => {
        const thumbnailUrl = 'mythumbnailhost.com/thumbnail'
        const updatedAt = 'The past!'
        sandbox
            .stub(PresentationsApiService.prototype, 'getPresentation')
            .returns({ thumbnailUrl, updatedAt })

        let responseStatusCode = 0
        let response = {}

        let mockedResponse: Response = <Response>{
            send: (body?: any) => {
                return
            },
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
                service: 'invision-presentation',
                serviceAssetId: '12356'
            },
            tracing: {},
            invision: {
                user: {
                    userId: 1,
                    teamId: '2'
                }
            }
        }
        controller
            .GetExternalDocument(mockedRequest, mockedResponse)
            .then((result) => {
                chai.expect(responseStatusCode).to.equal(200)
                chai.expect(response).to.deep.equals({
                    externalDocument: {
                        thumbnailUrl,
                        updatedAt
                    }
                })
                done()
            })
            .catch((err) => {
                done(err)
            })
    })

    it('should get a flat prototype', async () => {
        const requestResponseMock = new RequestResponseMock({
            params: {
                documentId: '6AEAF251-D906-4F7C-952D-14A05D033D7D'
            },
            query: {
                url: 'https://slate.invisionbeta.com/public/share/UVWTI7P7W'
            }
        })

        PrototypesApiService.prototype.getPrototypeByUrl = jest.fn(() => {
            return Promise.resolve({
                id: 1,
                name: 'prototype'
            })
        })

        await controller.GetFlatPrototype(
            requestResponseMock.request,
            requestResponseMock.response
        )

        expect(requestResponseMock.responseStatusCode).toEqual(200)
        expect(requestResponseMock.responseBody).toEqual({
            id: 1,
            name: 'prototype'
        })
    })

    it('should return 404 when flat prototype does not exist', async () => {
        const requestResponseMock = new RequestResponseMock({
            params: {
                documentId: '6AEAF251-D906-4F7C-952D-14A05D033D7D'
            },
            query: {
                url: 'https://slate.invisionbeta.com/public/share/UVWTI7P7W'
            }
        })

        PrototypesApiService.prototype.getPrototypeByUrl = jest.fn(() => {
            return Promise.resolve()
        })

        await controller.GetFlatPrototype(
            requestResponseMock.request,
            requestResponseMock.response
        )

        expect(requestResponseMock.responseStatusCode).toEqual(404)
        expect(requestResponseMock.responseBody).toEqual({
            message: 'Prototype not found'
        })
    })
})
