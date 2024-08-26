import { Router } from 'express'
import { PrivateAPI } from './Api'
import { Router as TypedRouter } from '@invisionapp/typed-api-defs/dist/express'
import { Logger } from '../../util/Logger'
import { DocumentController } from '../Document/Controller'
import { TeamController } from '../Team/Controller'
import createMetrics from '../../middleware/Metrics'
import * as validate from 'express-validation'
import paginationMiddleware from '../../middleware/Pagination'
import {
    getDocumentValidation,
    emitGenericEventValidation
} from '../Document/Validations'
import { getTeamDocumentsValidation } from './Validations'
import { wrap as asyncify } from 'async-middleware'

export class PrivateController {
    router: TypedRouter<PrivateAPI>
    logger: Logger
    documentController: DocumentController
    teamController: TeamController

    constructor() {
        this.router = Router()
        this.documentController = new DocumentController()
        this.teamController = new TeamController()
        this.init()
    }

    init() {
        this.router.get(
            '/documents/:documentId',
            createMetrics('/v1/private'),
            validate(getDocumentValidation),
            this.documentController.GetDocumentAsGuest
        )
        this.router.get(
            '/teams/:teamId/documents',
            createMetrics('/v1/teams'),
            validate(getTeamDocumentsValidation),
            paginationMiddleware,
            asyncify(this.teamController.GetTeamDocuments)
        )
        this.router.post(
            '/documents/:documentId/emit-event',
            createMetrics('/v1/private'),
            validate(emitGenericEventValidation),
            this.documentController.EmitGenericEvent
        )
    }
}

const privateController = new PrivateController()
privateController.init()

export default privateController.router as Router
