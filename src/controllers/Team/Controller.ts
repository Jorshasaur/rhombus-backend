import { Router } from 'express'
import * as validate from 'express-validation'
import { wrap as asyncify } from 'async-middleware'
import { IFindOptions, Sequelize, IIncludeOptions } from 'sequelize-typescript'
import { WhereOptions } from 'sequelize'
import { Document } from '../../models/Document'
import paginationMiddleware from '../../middleware/Pagination'
import { DocumentMembership } from '../../models/DocumentMembership'
import { transformDocuments, parseDocumentIds } from '../utils'
import createMetrics from '../../middleware/Metrics'
import { Router as TypedRouter } from '@invisionapp/typed-api-defs/dist/express'
import {
    TeamApi,
    GetTeamDocumentsRequest,
    GetTeamDocumentsResponse,
    GetUserDocumentsRequest,
    GetUserDocumentsResponse
} from './Api'
import {
    GetTeamDocumentsPrivateRequest,
    GetTeamDocumentsPrivateResponse
} from '../Private/Api'
import {
    getTeamDocumentsValidation,
    getUserDocumentsValidation
} from './Validations'
import AssetsApiService from '../../services/AssetsApiService'
import DocumentResponse from '../../interfaces/DocumentResponse'
import { NonAbstractTypeOfModel } from 'sequelize-typescript/lib/models/Model'

interface GetDocumentParams {
    teamId: string
    userId?: number
    documentIds?: string[]
    isArchived?: boolean
}

export class TeamController {
    router: TypedRouter<TeamApi>

    constructor() {
        this.router = Router({ mergeParams: true })

        this.GetTeamDocuments = this.GetTeamDocuments.bind(this)
        this.GetUserDocuments = this.GetUserDocuments.bind(this)
    }

    private getDocuments(
        params: GetDocumentParams,
        pagination: Express.Pagination
    ) {
        const { teamId, userId, documentIds, isArchived } = params

        const where: WhereOptions<Document> = { teamId }

        const includeMembership: IIncludeOptions = {
            model: DocumentMembership,
            attributes: ['userId', 'lastViewed']
        }

        const query: IFindOptions<Document> = {
            offset: pagination.offset,
            limit: pagination.limit,
            include: [includeMembership]
        }

        if (userId) {
            includeMembership.where = { userId }
        }

        if (documentIds) {
            where.id = { [Sequelize.Op.in]: documentIds }
        }

        let model: NonAbstractTypeOfModel<Document>
        if (isArchived) {
            model = Document.scope('archived')
        } else {
            model = Document
        }

        query.where = where

        return model.findAll<Document>(query)
    }

    private async getDocumentThumbnails(
        documents: DocumentResponse[],
        request:
            | GetTeamDocumentsRequest
            | GetUserDocumentsRequest
            | GetTeamDocumentsPrivateRequest
    ) {
        let assetKeys: string[] = []
        // Get Document thumbnail assets
        documents.forEach((document) => {
            if (document.thumbnailAssetKey) {
                assetKeys.push(document.thumbnailAssetKey)
            }
        })
        // Get Assets
        const assetsApiService = new AssetsApiService(request)
        const thumbnailAssets = await assetsApiService.getUrls(
            assetKeys,
            request.tracing
        )

        const response = await Promise.all(
            documents.map(async (document) => {
                // If document doesn't have an asset key, return the document
                if (!document.thumbnailAssetKey) {
                    return document
                }
                // Find the documents thumbnail asset by it's key
                let thumbnailAsset
                if (thumbnailAssets) {
                    thumbnailAsset = thumbnailAssets.find(
                        (asset) => asset.assetKey === document.thumbnailAssetKey
                    )
                }
                // If no thumbnail asset is found, return the document
                if (!thumbnailAsset) {
                    return document
                }
                // Return the document with it's thumbnail
                return {
                    ...document,
                    thumbnailUrl: thumbnailAsset.path
                }
            })
        )
        return response
    }

    public async GetTeamDocuments(
        req: GetTeamDocumentsRequest | GetTeamDocumentsPrivateRequest,
        res: GetTeamDocumentsResponse | GetTeamDocumentsPrivateResponse
    ) {
        const { teamId } = req.params
        const { documentIds, includeThumbnails, isArchived } = req.query

        const params: GetDocumentParams = { teamId, isArchived }

        if (documentIds) {
            params.documentIds = parseDocumentIds(documentIds)
        }

        const documents = await this.getDocuments(params, req.pagination)
        let documentJSON = transformDocuments(documents)

        if (includeThumbnails) {
            documentJSON = await this.getDocumentThumbnails(documentJSON, req)
        }

        res.json({
            documents: documentJSON
        })
    }

    public async GetUserDocuments(
        req: GetUserDocumentsRequest,
        res: GetUserDocumentsResponse
    ) {
        const { teamId, userId } = req.params
        const { includeThumbnails, isArchived } = req.query

        const documents = await this.getDocuments(
            { teamId, userId, isArchived },
            req.pagination
        )
        let documentJSON = transformDocuments(documents)
        if (includeThumbnails) {
            documentJSON = await this.getDocumentThumbnails(documentJSON, req)
        }

        res.json({
            documents: documentJSON
        })
    }

    init() {
        this.router.get(
            '/:teamId/documents',
            createMetrics('/v1/teams'),
            validate(getTeamDocumentsValidation),
            paginationMiddleware,
            asyncify(this.GetTeamDocuments)
        )
        this.router.get(
            '/:teamId/users/:userId/documents',
            createMetrics('/v1/teams'),
            validate(getUserDocumentsValidation),
            paginationMiddleware,
            asyncify(this.GetUserDocuments)
        )
    }
}

const teamController = new TeamController()
teamController.init()

export default teamController.router as Router
