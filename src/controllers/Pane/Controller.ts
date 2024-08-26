import { Router } from 'express'
import { wrap as asyncify } from 'async-middleware'
import { Logger } from '../../util/Logger'
import {
    createPaneValidation,
    revisionsSinceRevisionValidation,
    getPaneValidation,
    duplicatePaneValidation
} from './Validations'
import {
    CreatePaneRequest,
    CreatePaneResponse,
    GetRevisionsSinceRevisionRequest,
    GetRevisionsSinceRevisionResponse,
    GetPaneRequest,
    GetPaneResponse,
    DuplicatePaneRequest,
    DuplicatePaneResponse
} from './Api'
import { getDocument, getPane } from '../Helpers'
import SequelizeManager from '../../util/SequelizeManager'
import { Transaction } from 'sequelize'
import { Pane } from '../../models/Pane'
import createMetrics from '../../middleware/Metrics'
import * as validate from 'express-validation'
import { PaneDocument } from '../../models/PaneDocument'
import { PaneRevision } from '../../models/PaneRevision'

function revisionToResponse(revision: PaneRevision) {
    return {
        operation: { ops: revision.operation },
        revision: revision.revision,
        userId: revision.userId,
        submissionId: revision.submissionId,
        createdAt: revision.createdAt.getTime()
    }
}

export class PaneController {
    router = Router()
    logger = Logger

    constructor() {
        this.router.post(
            '/',
            createMetrics('/v1/panes'),
            validate(createPaneValidation),
            asyncify(this.CreatePane)
        )
        this.router.get(
            '/:paneId',
            createMetrics('/v1/panes'),
            validate(getPaneValidation),
            asyncify(this.GetPane)
        )
        this.router.post(
            '/:paneId/duplicate',
            createMetrics('/v1/panes'),
            validate(duplicatePaneValidation),
            asyncify(this.DuplicatePane)
        )
        this.router.get(
            '/:paneId/revisionsSinceRevision/:revision',
            createMetrics('/v1/panes'),
            validate(revisionsSinceRevisionValidation),
            asyncify(this.GetRevisionsSinceRevision)
        )
    }

    public CreatePane = async (
        req: CreatePaneRequest,
        res: CreatePaneResponse
    ) => {
        const { documentId, title } = req.body
        const { teamId, userId } = req.invision.user

        const document = await getDocument(documentId, teamId)

        await req.permissions.canChangeDocument(document)

        const result = await SequelizeManager.getInstance().sequelize.transaction(
            async (transaction: Transaction) => {
                const pane = await Pane.create(
                    {
                        title,
                        teamId,
                        owningDocumentId: documentId,
                        owningUserId: userId
                    },
                    { transaction }
                )

                await PaneDocument.create(
                    { paneId: pane.id, documentId, teamId },
                    { transaction }
                )
                const paneContents = await pane.contents({ transaction })

                return {
                    ...paneContents,
                    id: pane.id
                }
            }
        )

        res.json(result)
    }

    public DuplicatePane = async (
        req: DuplicatePaneRequest,
        res: DuplicatePaneResponse
    ) => {
        const { documentId } = req.body
        const { paneId } = req.params
        const { teamId, userId } = req.invision.user

        const document = await getDocument(documentId, teamId)
        await req.permissions.canChangeDocument(document)

        const result = await SequelizeManager.getInstance().sequelize.transaction(
            async (transaction: Transaction) => {
                const sourcePane = await Pane.findOne({
                    where: {
                        teamId,
                        id: paneId
                    },
                    transaction
                })

                if (sourcePane) {
                    const cloneId = await sourcePane.duplicate(
                        documentId,
                        userId.toString(),
                        transaction
                    )

                    await PaneDocument.create(
                        { paneId: cloneId, documentId, teamId },
                        { transaction }
                    )

                    return {
                        id: cloneId
                    }
                } else {
                    throw new Error('Cannot duplicate a pane that doesnt exist')
                }
            }
        )
        res.json(result)
    }

    public GetPane = async (req: GetPaneRequest, res: GetPaneResponse) => {
        const document = await getDocument(
            req.query.documentId,
            req.invision.user.teamId
        )
        await req.permissions.canViewDocument(document)
        const pane = await getPane(req.params.paneId, req.invision.user.teamId)
        const contents = await pane.contents()
        res.json(contents)
    }

    public GetRevisionsSinceRevision = async (
        req: GetRevisionsSinceRevisionRequest,
        res: GetRevisionsSinceRevisionResponse
    ) => {
        const document = await getDocument(
            req.query.documentId,
            req.invision.user.teamId
        )
        await req.permissions.canViewDocument(document)

        const pane = await getPane(req.params.paneId, req.invision.user.teamId)

        const previousRevisions = await pane.getRevisionsAfterRevision(
            req.params.revision
        )

        return res.status(200).json({
            revisions: previousRevisions.map(revisionToResponse)
        })
    }
}

const controller = new PaneController()
export default controller.router as Router
