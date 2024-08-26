import { Request, Response, NextFunction } from 'express'
import { ValidationError } from 'express-validation'
import { Logger } from '../util/Logger'
import { PermissionsError } from './Permissions'
import { ErrorCollector } from '../util/ErrorCollector'
const logger = Logger

export default function HandleErrors(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (err instanceof ValidationError) {
        ErrorCollector.notify(err, { req, severity: 'warning' })
        res.status(err.status).json(err)
    } else if (err instanceof PermissionsError) {
        logger.debug(
            `Permissions error reason: ${err.reason} on ${req.originalUrl} from user ${req.invision.user.userId}`
        )
        res.status(403).json(err)
    } else if (
        err instanceof ArchiveError ||
        err instanceof DocumentNotFoundError
    ) {
        logger.debug(err.message)
        res.status(404).json(err)
    } else if (err) {
        ErrorCollector.notify(err, { req, severity: 'error' })
        logger.error({ err })
        res.status(500).json({ message: err.message })
    }
}

export class ArchiveError extends Error {
    public static readonly MESSAGE =
        'The operation could not be performed because the document is archived.'

    constructor() {
        super(ArchiveError.MESSAGE)
        this.name = 'Archive Error'
    }
}

export class DocumentNotFoundError extends Error {
    public static readonly MESSAGE = 'The document specified was not found.'

    constructor() {
        super(DocumentNotFoundError.MESSAGE)
        this.name = 'Document Not Found'
    }
}

export class PaneNotFoundError extends Error {
    public static readonly MESSAGE = 'The pane specified was not found.'

    constructor() {
        super(PaneNotFoundError.MESSAGE)
        this.name = 'pane Not Found'
    }
}
