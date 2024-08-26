import DocumentResponse from '../interfaces/DocumentResponse'
import { Config } from '../config'
import { Document } from '../models/Document'
import * as slug from 'slug'
import * as shortUuid from 'short-uuid'
import * as isUuid from 'is-uuid'
import { UNSAFE_URL_CHARACTERS } from '../constants/Strings'

const uuidTranslator = shortUuid()

export function getDocumentUrlPath(document: Document) {
    // Setting these characters to '?' makes slug filter them out.
    // Setting them to blank strings were inconsistent for some chars.
    let unsafeCharMap = UNSAFE_URL_CHARACTERS.split('').reduce(
        (charMap, c: string) => {
            charMap[c] = '?'
            return charMap
        },
        {}
    )

    let options = {
        lower: false,
        charmap: Object.assign({}, slug.charmap, unsafeCharMap)
    }

    const title = slug(document.title, options)
    const shortId = uuidTranslator.fromUUID(document.id)
    return `${Config.pagesBasePath}/${title}-${shortId}`
}

export function transformDocument(document: Document): DocumentResponse {
    return Object.assign(
        { url: `${getDocumentUrlPath(document)}` },
        document.toJSON()
    )
}

export function transformDocuments(documents: Document[]): DocumentResponse[] {
    return documents.map(transformDocument)
}

export function parseDocumentIds(documentIds: string | string[]): string[] {
    let parsedDocumentIds

    if (Array.isArray(documentIds)) {
        parsedDocumentIds = documentIds
    } else {
        parsedDocumentIds = documentIds.split(',')
    }

    return parsedDocumentIds.filter(isUuid.v4)
}
