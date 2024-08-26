import { wrap as asyncify } from 'async-middleware'
import { Request, Response, Router } from 'express'
import * as Delta from 'quill-delta'
import * as json1 from 'ot-json1'
import { DatabaseError, Transaction, UniqueConstraintError } from 'sequelize'
import { DocumentContents } from '../interfaces/DocumentContents'
import { createRequestHeaders } from '../interfaces/FreehandHeaders'
import {
    Operation,
    OperationType,
    DeltaOperation,
    PaneOperation
} from '../interfaces/Operation'
import {
    getReducedRequestFromRequest,
    ReducedRequest
} from '../interfaces/ReducedRequest'
import { ArchiveError } from '../middleware/HandleErrors'
import createMetrics from '../middleware/Metrics'
import { Permissions, PermissionsError } from '../middleware/Permissions'
import { Document } from '../models/Document'
import {
    DocumentRevision,
    transformDocumentOperation
} from '../models/DocumentRevision'
import { ErrorCollector } from '../util/ErrorCollector'
import { Logger } from '../util/Logger'
import {
    operationContainsChanges,
    operationContainsOnlyCommentChange
} from '../util/OperationContainsChanges'
import {
    isOperationComposable,
    isValidDocumentDelta
} from '../util/OperationIsComposable'
import SequelizeManager from '../util/SequelizeManager'
import SocketManager from '../util/SocketManager'
import { PaneRevision, transformPaneOperation } from '../models/PaneRevision'
import { getPane, getDocumentIdsForPane } from './Helpers'

class ValidationError extends Error {}

export class OperationController {
    router: Router
    logger: Logger

    constructor() {
        this.logger = Logger
        this.router = Router()
        json1.type.registerSubtype(require('rich-text'))
        this.init()
    }

    async getDocumentForRevisions(
        documentId: string,
        teamId: string,
        transaction: Transaction
    ): Promise<Document> {
        const document = await Document.findDocument(documentId, teamId, {
            transaction
        })
        if (!document) {
            throw new Error(
                'Rejecting Operation because the Document is undefined'
            )
        }
        if (document.isArchived) {
            throw new ArchiveError()
        }
        return document
    }

    async MakePaneRevision(
        userId: number,
        teamId: string,
        data: PaneOperation,
        transaction: Transaction,
        permissions: Permissions
    ): Promise<PaneRevision> {
        const document = await this.getDocumentForRevisions(
            data.documentId,
            teamId,
            transaction
        )
        await permissions.canSubmitOperation(document)
        const pane = await getPane(data.paneId, teamId)
        if (!pane) {
            throw new Error('Rejecting Operation because the Pane is undefined')
        }
        const revs = await pane.$get('revisions', {
            limit: 1,
            order: [['revision', 'DESC']],
            raw: true,
            transaction
        })
        const lastRevision = revs[0]

        this.isValidOperation(data.revision, lastRevision)

        const clientOperation = data.operation.ops

        // verify that we can actually apply the op before we make the revision
        const paneContents = await pane.contents({ transaction })
        const json1Document = json1.type.create(paneContents.contents)
        json1.type.apply(json1Document, clientOperation)

        const concurrentRevisions = await pane.getRevisionsAfterRevision(
            data.revision,
            true,
            transaction
        )

        const transformedClientOperation = transformPaneOperation(
            clientOperation,
            concurrentRevisions
        )

        const revision = (await pane.$create(
            'revision',
            {
                revision: lastRevision.revision + 1,
                operation: transformedClientOperation,
                submissionId: data.submissionId,
                userId,
                teamId,
                revert: data.revert
            },
            { transaction }
        )) as PaneRevision

        return revision
    }

    async MakeDocumentRevision(
        userId: number,
        teamId: string,
        data: DeltaOperation,
        transaction: Transaction,
        permissions: Permissions
    ): Promise<DocumentRevision> {
        const document = await this.getDocumentForRevisions(
            data.documentId,
            teamId,
            transaction
        )

        const revs = await document.$get('revisions', {
            limit: 1,
            order: [['revision', 'DESC']],
            raw: true,
            transaction
        })
        const lastRevision = revs[0]

        this.isValidOperation(data.revision, lastRevision)

        const documentContents = await document.contents({ transaction })
        const clientOperation = new Delta(data.operation)

        if (
            operationContainsChanges(data.operation) &&
            !operationContainsOnlyCommentChange(
                documentContents.delta,
                clientOperation
            )
        ) {
            await permissions.canSubmitOperation(document)
        }

        // In the case where we've submitted a revision number that is behind the
        // current revision (or equal) we need to get the missing revisions and
        // merge them in.
        const concurrentRevisions = await document.getRevisionsAfterRevision(
            data.revision,
            true,
            transaction
        )

        const transformedClientOperation = transformDocumentOperation(
            clientOperation,
            concurrentRevisions
        )

        await this.isComposableOperation(
            documentContents,
            document.id,
            transformedClientOperation
        )

        // debugger
        this.logger.debug('====================> WRITING REVISION')
        const revision = (await document.$create(
            'revision',
            {
                revision: lastRevision.revision + 1,
                delta: transformedClientOperation,
                submissionId: data.submissionId,
                sentAt: new Date(),
                userId,
                revert: data.revert
            },
            { transaction }
        )) as DocumentRevision

        return revision
    }

    async isComposableOperation(
        documentContents: DocumentContents,
        documentId: string,
        operation: Delta
    ) {
        if (isValidDocumentDelta(documentContents.delta)) {
            if (!isOperationComposable(documentContents, operation)) {
                // throw new ValidationError(
                //     'Operation is not composable with the document'
                // )
                ErrorCollector.notify(
                    `Operation is not composable with document ${documentId}`,
                    { severity: 'warning', operation }
                )
            }
        } else {
            ErrorCollector.notify(
                `Document ${documentId} contains invalid operation`,
                { severity: 'warning' }
            )
        }
    }

    public isValidOperation(
        incomingRevision: number,
        lastRevision?: { revision: number }
    ) {
        const previousRevision = lastRevision ? lastRevision.revision : null
        // We are enforcing non-nulls for revisions, but this is just to be double sure
        // that we aren't pushing in revisions without revision numbers
        if (!incomingRevision || incomingRevision < 0) {
            throw new ValidationError(
                `Incoming revision is ${incomingRevision} and must be valid and gte 0`
            )
        }

        // The incoming revision must be greater than the previous revision by exactly 1
        if (previousRevision && incomingRevision > previousRevision + 1) {
            throw new ValidationError(
                `Incoming revision (${incomingRevision}) is more than 1 revision ahead of previous revision (${previousRevision})`
            )
        }

        return true
    }

    private _handleOperationError = async (
        req: Request,
        res: Response,
        error: Error
    ) => {
        const data: Operation = req.body.data

        switch (error.constructor) {
            case UniqueConstraintError:
                const { fields } = error as any
                if (fields != null && fields.submissionId != null) {
                    return res.status(200).json({})
                }
                break
            case ValidationError:
            case PermissionsError:
            case DatabaseError:
                // Check if revision with submission ID exists
                const RevisionType =
                    data.type === OperationType.JSON1
                        ? PaneRevision
                        : DocumentRevision
                const revisionSubmitted = await RevisionType.checkForSubmittedRevision(
                    req.invision!.user!.userId,
                    data
                ).catch((checkForSubmittedRevisionError) => {
                    ErrorCollector.notify(error, { req, severity: 'error' })
                    throw checkForSubmittedRevisionError
                })

                // Rollback if revision is not found
                if (!revisionSubmitted) {
                    this.logger.error(`Error submitting operation: ${error}`)
                    ErrorCollector.notify(error, { req, severity: 'error' })
                    return res.status(428).json(data)
                }

                return res.status(500).json({ message: error.message })
        }

        ErrorCollector.notify(error, { req, severity: 'error' })
        throw error
    }

    public SubmitOperation = async (req: Request, res: Response) => {
        const data: Operation = req.body.data
        let revision: DocumentRevision | PaneRevision
        return SequelizeManager.getInstance()
            .sequelize.transaction(async (transaction: Transaction) => {
                // check permission
                const document = await Document.findById<Document>(
                    data.documentId
                )
                if (document == null) {
                    res.status(404).send({ message: 'Document not found' })
                    return
                }

                let RevisionType
                let advisoryString = 'document-' + data.documentId

                if (data.type === OperationType.JSON1) {
                    advisoryString = `pane-${(data as PaneOperation).paneId}`
                    RevisionType = PaneRevision
                } else {
                    RevisionType = DocumentRevision
                }

                await SequelizeManager.getInstance().createAdvisoryLock(
                    advisoryString,
                    transaction
                )

                const hasAlreadySubmittedRevision = await RevisionType.checkForSubmittedRevision(
                    req.invision!.user!.userId,
                    data
                )
                if (hasAlreadySubmittedRevision) {
                    return res.status(200).json({})
                }

                if (data.type === OperationType.JSON1) {
                    revision = await this.MakePaneRevision(
                        req.invision!.user!.userId,
                        req.invision!.user!.teamId,
                        data as PaneOperation,
                        transaction,
                        req.permissions
                    )
                } else {
                    revision = await this.MakeDocumentRevision(
                        req.invision!.user!.userId,
                        req.invision!.user!.teamId,
                        data as DeltaOperation,
                        transaction,
                        req.permissions
                    )
                }

                const operation: Operation = {
                    documentId: data.documentId,
                    revision: revision.revision,
                    operation: revision.getOperation(),
                    submissionId: revision.submissionId,
                    revert: revision.revert,
                    type: data.type
                }

                if (data.type === OperationType.JSON1) {
                    const paneData = data as PaneOperation
                    ;(operation as PaneOperation).paneId = paneData.paneId
                    const documents = await getDocumentIdsForPane(
                        paneData.paneId,
                        req.invision!.user!.teamId
                    )
                    SocketManager.getInstance().sendPaneUpdated(
                        documents,
                        operation as PaneOperation
                    )
                } else {
                    SocketManager.getInstance().emitOperation(
                        data.documentId,
                        operation
                    )
                }

                return res.status(200).json(operation)
            })
            .catch((error) => {
                return this._handleOperationError(req, res, error)
            })
            .finally(() => {
                const reducedRequest: ReducedRequest = getReducedRequestFromRequest(
                    req
                )
                reducedRequest.route = req.route

                const requestHeaders = createRequestHeaders(req)

                revision &&
                    revision.runAfterSubmitHooks(
                        reducedRequest.invision.user.userId,
                        reducedRequest.invision.user.vendorId,
                        reducedRequest,
                        requestHeaders,
                        data.documentId
                    )
            })
    }

    init() {
        this.router.post(
            '/submit',
            createMetrics('/v1/operations'),
            asyncify(this.SubmitOperation)
        ),
            this.router.post(
                '/pane/submit',
                createMetrics('/v1/operations'),
                asyncify(this.SubmitOperation)
            ),
            this.router.post(
                '/document/submit',
                createMetrics('/v1/operations'),
                asyncify(this.SubmitOperation)
            )
    }
}

const operationController = new OperationController()
operationController.init()

export default operationController.router
