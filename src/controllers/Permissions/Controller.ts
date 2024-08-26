import { Router } from 'express'
import * as validate from 'express-validation'
import { DocumentMembership } from '../../models/DocumentMembership'
import { Document } from '../../models/Document'
import { Logger } from '../../util/Logger'
import createMetrics from '../../middleware/Metrics'
import {
    GetPermissionsRequest,
    GetPermissionsResponse,
    PermissionsAPI
} from './Api'
import { Router as TypedRouter } from '@invisionapp/typed-api-defs/dist/express'
import { IFindOptions, Sequelize } from 'sequelize-typescript'
import { WhereOptions } from 'sequelize'
import { getPermissionsValidation } from './Validations'
import { parseDocumentIds } from '../utils'
import PermissionsService from '../../services/permissions/Service'
import { PermissionsActions } from '../../services/permissions/Actions'

export class PermissionsController {
    router: TypedRouter<PermissionsAPI>
    logger: Logger

    constructor() {
        this.router = Router()
        this.init()
        this.logger = Logger
    }

    public GetPermissions = async (
        req: GetPermissionsRequest,
        res: GetPermissionsResponse
    ) => {
        const { document_ids, actions } = req.query
        const { userId, teamId } = req.invision.user

        let parsedDocumentIds

        if (document_ids) {
            parsedDocumentIds = parseDocumentIds(document_ids)
        }

        const documents = await this.getDocuments(
            userId,
            teamId,
            parsedDocumentIds
        )
        const permissionsService = new PermissionsService(userId, teamId, req)
        const data = await permissionsService.permissionsForDocuments(
            documents,
            actions.split(',') as PermissionsActions[]
        )
        if (data == null) {
            throw new Error('Unable to get permissions')
        }

        res.json({ data })
    }

    private getDocuments(
        userId: number,
        teamId: string,
        documentIds?: string[]
    ) {
        const where: WhereOptions<Document> = { teamId }

        const query: IFindOptions<Document> = {
            include: [
                {
                    model: DocumentMembership,
                    attributes: ['userId', 'permissions'],
                    where: {
                        userId
                    },
                    required: false
                }
            ]
        }

        if (documentIds) {
            where.id = { [Sequelize.Op.in]: documentIds }
        }

        query.where = where

        return Document.findAll<Document>(query)
    }

    init() {
        this.router.get(
            '/',
            createMetrics('/v1/permissions'),
            validate(getPermissionsValidation),
            this.GetPermissions
        )
    }
}

const permissionsController = new PermissionsController()
permissionsController.init()

export default permissionsController.router as Router
