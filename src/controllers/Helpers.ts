import { Document } from '../models/Document'
import {
    DocumentNotFoundError,
    ArchiveError,
    PaneNotFoundError
} from '../middleware/HandleErrors'
import { Pane } from '../models/Pane'
import { PaneDocument } from '../models/PaneDocument'

export async function getDocument(documentId: string, teamId: string) {
    const document = await Document.findDocument(documentId, teamId)
    if (document === null) {
        throw new DocumentNotFoundError()
    }
    if (document.isArchived) {
        throw new ArchiveError()
    }
    return document
}

export async function getPane(paneId: string, teamId: string) {
    const pane = await Pane.findPane(paneId, teamId)
    if (pane === null) {
        throw new PaneNotFoundError()
    }
    return pane
}

export async function getPaneFromPaneDocument(
    paneDocumentId: string,
    teamId: string
) {
    const paneDocument = await PaneDocument.findOne<PaneDocument>({
        where: {
            id: paneDocumentId,
            teamId
        }
    })
    if (paneDocument === null) {
        throw new PaneNotFoundError()
    }
    const pane = Pane.findOne<Pane>({
        where: {
            id: paneDocument.paneId,
            teamId
        }
    })
    if (pane === null) {
        throw new PaneNotFoundError()
    }
    return pane
}

export async function getDocumentIdsForPane(paneId: string, teamId: string) {
    let documents: string[] = []
    const paneDocuments = await PaneDocument.findAll({
        where: {
            paneId,
            teamId
        }
    })

    const results = paneDocuments.map((pDocument: PaneDocument) => {
        return pDocument.documentId
    })

    if (results) {
        documents = results
    }
    return documents
}
