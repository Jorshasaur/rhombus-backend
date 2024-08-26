import { Router, Request, Response } from 'express'
import { wrap as asyncify } from 'async-middleware'
import * as validate from 'express-validation'
import * as _ from 'lodash'
import { Sequelize, IFindOptions } from 'sequelize-typescript'
import { Logger } from '../../util/Logger'
import AssetsApiService, {
    AssetResponse
} from '../../services/AssetsApiService'
import FreehandApiService from '../../services/FreehandApiService'
import { Asset } from '../../models/Asset'
import { Document } from '../../models/Document'
import { RequestTracing } from '../../middleware/RequestTracing'
import { sortBy, find, compact } from 'lodash'
import PresentationsApiService from '../../services/PresentationsApiService'
import createMetrics from '../../middleware/Metrics'
import {
    listAssetsValidation,
    requestUploadValidation,
    finishUploadValidation,
    copyAssetValidation,
    copyAssetFromUrlValidation,
    getAssetValidation,
    getExternalDocumentValidation,
    getFlatPrototypeValidation
} from './Validations'
import PrototypesApiService from '../../services/PrototypesApiService'

interface AssetRequest {
    fileName: string
}

interface AssetResult {
    id: string
    fileName: string
    url: string
}

interface ExternalDocument {
    name?: string
    thumbnailUrl?: string
    updatedAt?: string
    width?: number
    height?: number
}

export class AssetController {
    router: Router
    logger: Logger

    constructor() {
        this.router = Router({ mergeParams: true })
        this.logger = Logger

        this.ListAssets = this.ListAssets.bind(this)
        this.RequestUpload = this.RequestUpload.bind(this)
        this.FinishUpload = this.FinishUpload.bind(this)
        this.GetAsset = this.GetAsset.bind(this)
    }

    private async getAssetsFromRecords(
        assetRecords: Asset[],
        tracing: RequestTracing,
        req: Request
    ): Promise<AssetResult[]> {
        // get asset keys
        const assetKeys = assetRecords.map((assetRecord: Asset) => {
            return assetRecord.assetKey
        })

        // get urls from assets api
        const assetsApiService = new AssetsApiService(req)
        const assets = await assetsApiService.getInfo(assetKeys, tracing)
        if (assets == null) {
            throw new Error('Unable to get assets from assets api')
        }

        // combine results
        return this.combineResults(assetRecords, assets)
    }

    public async ListAssets(req: Request, res: Response) {
        const documentId = req.params.documentId

        // get uploaded assets for document
        const assetRecords = await Asset.findAll<Asset>({
            where: {
                documentId,
                uploaded: {
                    [Sequelize.Op.is]: true
                }
            }
        })

        if (assetRecords.length < 1) {
            res.json({ assets: [] })
            return
        }
        const assetsResult = await this.getAssetsFromRecords(
            assetRecords,
            req.tracing,
            req
        )

        res.json({ assets: assetsResult })
    }

    public combineResults(
        assetRecords: Asset[],
        assets: AssetResponse[]
    ): AssetResult[] {
        assetRecords = sortBy(assetRecords, 'assetKey')

        const results = assetRecords.map((assetRecord: Asset) => {
            const asset = find(assets, {
                assetKey: assetRecord.assetKey
            })
            if (!asset) {
                return
            }

            const { id, fileName, createdAt } = assetRecord
            const { url, content_type: contentType } = asset
            return {
                id,
                fileName,
                url,
                contentType,
                createdAt
            }
        })

        return compact(results)
    }

    public async RequestUpload(req: Request, res: Response) {
        const assetRequests: AssetRequest[] = req.body.assets
        const { documentId } = req.params

        // get upload urls for asset requests from assets api
        const assetsApiService = new AssetsApiService(req)
        const assets = await assetsApiService.createAssets(
            assetRequests.length,
            req.invision.user.teamId,
            req.tracing
        )
        if (assets == null) {
            throw new Error('Unable to create assets in assets api')
        }

        // save assets to db
        const assetRecords = assets.map(
            ({ assetKey }: AssetResponse, index: number) => {
                const { fileName } = assetRequests[index]

                return {
                    documentId,
                    assetKey,
                    fileName
                }
            }
        )

        const createdAssetRecords = await Asset.bulkCreate<Asset>(
            assetRecords,
            { returning: true }
        )

        // combine fileName, id and url
        const assetsResult = this.combineResults(createdAssetRecords, assets)

        res.json({ assets: assetsResult })
    }

    public async FinishUpload(req: Request, res: Response) {
        const { documentId } = req.params
        const assetIds: string[] = req.body.assetIds

        await Asset.update(
            { uploaded: true },
            {
                where: {
                    id: { in: assetIds },
                    documentId
                }
            }
        )

        const assetRecords = await Asset.findAll<Asset>({
            where: {
                id: { [Sequelize.Op.in]: assetIds },
                documentId
            }
        })
        const assetsResult = await this.getAssetsFromRecords(
            assetRecords,
            req.tracing,
            req
        )

        res.json({ assets: assetsResult })
    }

    public async GetAsset(req: Request, res: Response) {
        const { assetId, documentId } = req.params

        // find asset in database
        const assetRecord = await Asset.findOne<Asset>({
            where: {
                id: assetId,
                documentId
            }
        })
        if (assetRecord == null) {
            res.status(404).send({ message: 'Asset not found' })
            return
        }

        this.fetchAsset(req, res, assetRecord)
    }

    async fetchAsset(req: Request, res: Response, assetRecord: Asset) {
        const assetsApiService = new AssetsApiService(req)
        const assets = await assetsApiService.getUrls(
            [assetRecord.assetKey],
            req.tracing
        )
        if (assets == null) {
            throw new Error('Unable to get asset from assets api')
        }

        const asset = assets[0]
        if (asset == null) {
            res.status(404).send({ message: 'Asset not found' })
            return
        }

        res.json({
            id: assetRecord.id,
            url: asset.url,
            fileName: assetRecord.fileName,
            createdAt: assetRecord.createdAt
        })
    }

    async CopyAsset(
        req: Request,
        res: Response,
        findAssetOptions: IFindOptions<Asset>
    ) {
        const { documentId } = req.params

        // find asset in database
        const assetRecord = await Asset.findOne<Asset>(findAssetOptions)
        if (assetRecord == null) {
            res.status(404).send({ message: 'Asset not found' })
            return
        }

        // check if user has permissions for given asset
        const document = await Document.findById<Document>(
            assetRecord.documentId
        )
        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }
        await req.permissions.canJoinAndViewDocument(document)

        // if given documentId and asset documentId then just return asset without copying
        if (documentId === assetRecord.documentId) {
            this.fetchAsset(req, res, assetRecord)
            return
        }

        // copy asset in assets api
        const assetsApiService = new AssetsApiService(req)
        const newAsset = await assetsApiService.copyAsset(
            assetRecord.assetKey,
            req.tracing
        )
        if (newAsset == null) {
            throw new Error('Unable to copy asset in assets api')
        }

        // save new asset to db
        const newAssetRecord = await Asset.create<Asset>({
            documentId,
            assetKey: newAsset.assetKey,
            fileName: assetRecord.fileName,
            uploaded: true
        })

        res.json({
            id: newAssetRecord.id,
            url: newAsset.url,
            fileName: newAssetRecord.fileName,
            createdAt: newAssetRecord.createdAt
        })
    }

    public CopyAssetFromId = async (req: Request, res: Response) => {
        const { assetId } = req.body

        await this.CopyAsset(req, res, {
            where: {
                id: assetId
            }
        })
    }

    public CopyAssetFromUrl = async (req: Request, res: Response) => {
        const { assetUrl } = req.body

        const assetsApiService = new AssetsApiService(req)

        // get asset from assets api
        const asset = await assetsApiService.getAssetFromUrl(
            assetUrl,
            req.tracing
        )
        if (asset == null) {
            throw new Error('Unable to get asset from assets api')
        }

        await this.CopyAsset(req, res, {
            where: {
                assetKey: asset.assetKey
            }
        })
    }

    public GetFlatPrototype = async (req: Request, res: Response) => {
        const { url } = req.query
        const { userId, teamId } = req.invision.user

        const prototypesApiService = new PrototypesApiService(req)
        const prototype = await prototypesApiService.getPrototypeByUrl(
            url,
            userId,
            teamId,
            req.tracing
        )

        if (prototype == null) {
            res.status(404).send({ message: 'Prototype not found' })
        } else {
            res.json(prototype)
        }
    }

    public GetExternalDocument = async (req: Request, res: Response) => {
        const { service, serviceAssetId } = req.params
        let externalDocument: ExternalDocument = {}
        if (!service) {
            res.status(400).send({ message: 'Missing required param service' })
            return
        }
        if (!serviceAssetId) {
            res.status(400).send({
                message: 'Missing required param serviceAssetId'
            })
            return
        }
        switch (service) {
            case 'invision-presentation':
                {
                    const presentationsApiService = new PresentationsApiService(
                        req
                    )
                    const presentationsResponse = await presentationsApiService.getPresentation(
                        req.invision.user.userId,
                        req.invision.user.teamId,
                        serviceAssetId,
                        req.tracing
                    )
                    if (presentationsResponse) {
                        externalDocument = presentationsResponse
                    }
                }
                break
            case 'freehand-private':
            case 'freehand-public':
                {
                    const userIp = req.headers
                        ? req.headers['x-forwarded-for']
                        : undefined
                    const userAgent = req.headers
                        ? req.headers['user-agent']
                        : undefined

                    if (!userIp || !userAgent) {
                        res.status(400).send({
                            message:
                                'Missing required headers x-forwarded-for and user-agent'
                        })
                        return
                    }

                    const host = _.get(req, ['headers', 'x-forwarded-host'])
                    const freehandApiService = new FreehandApiService(req)
                    const freehandResponse = await freehandApiService.getFreehand(
                        serviceAssetId,
                        req.tracing,
                        service === 'freehand-public' ? 'public' : 'private',
                        userIp,
                        userAgent
                    )
                    freehandResponse && freehandResponse.thumbnailUrl
                        ? (externalDocument.thumbnailUrl =
                              '//' + host + freehandResponse.thumbnailUrl)
                        : null
                    freehandResponse && freehandResponse.name
                        ? (externalDocument.name = freehandResponse.name)
                        : null
                    freehandResponse && freehandResponse.updatedAt
                        ? (externalDocument.updatedAt =
                              freehandResponse.updatedAt)
                        : null
                }
                break
            default:
                break
        }

        if (!Object.keys(externalDocument).length) {
            res.status(404).send({ message: 'Remote document not found' })
            return
        }
        res.json({
            externalDocument
        })
    }

    init() {
        this.router.get(
            '/',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(listAssetsValidation),
            asyncify(this.ListAssets)
        )
        this.router.post(
            '/request-upload',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(requestUploadValidation),
            asyncify(this.RequestUpload)
        )
        this.router.post(
            '/finish-upload',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(finishUploadValidation),
            asyncify(this.FinishUpload)
        )
        this.router.post(
            '/copy',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(copyAssetValidation),
            asyncify(this.CopyAssetFromId)
        )
        this.router.post(
            '/copy-from-url',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(copyAssetFromUrlValidation),
            asyncify(this.CopyAssetFromUrl)
        )
        this.router.get(
            '/flat-prototype',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(getFlatPrototypeValidation),
            asyncify(this.GetFlatPrototype)
        )
        this.router.get(
            '/:assetId',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(getAssetValidation),
            asyncify(this.GetAsset)
        )
        this.router.get(
            '/external-document/:service/:serviceAssetId',
            createMetrics('/v1/documents/:documentId/assets'),
            validate(getExternalDocumentValidation),
            asyncify(this.GetExternalDocument)
        )
    }
}

const assetController = new AssetController()
assetController.init()

export default assetController.router
