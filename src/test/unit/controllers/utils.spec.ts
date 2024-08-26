import {
    getDocumentUrlPath,
    transformDocument,
    transformDocuments,
    parseDocumentIds
} from '../../../controllers/utils'
import { getDocumentRecord } from './utils'
import { UNSAFE_URL_CHARACTERS } from '../../../constants/Strings'

describe('utils', () => {
    it('should return url with title slug and short id', () => {
        const documentRecord = getDocumentRecord()
        expect(getDocumentUrlPath(documentRecord)).toEqual(
            '/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN'
        )

        documentRecord.title = '+ěščřžýááíé@$%^& ' + UNSAFE_URL_CHARACTERS
        expect(getDocumentUrlPath(documentRecord)).toEqual(
            '/rhombus/escrzyaaiedollarand-ri2LMJy6XeZ6k2eKnphbtN'
        )

        documentRecord.title = 'unicode ♥ is ☢'
        expect(getDocumentUrlPath(documentRecord)).toEqual(
            '/rhombus/unicode-love-is-radioactive-ri2LMJy6XeZ6k2eKnphbtN'
        )
    })

    it('should add url to document', () => {
        const documentRecord = getDocumentRecord()
        const expectedResult = Object.assign(documentRecord, {
            url: '/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN'
        })
        expect(transformDocument(documentRecord)).toEqual(expectedResult)
    })

    it('should add url to documents', () => {
        const documentRecord = getDocumentRecord()
        const documents = [documentRecord]

        const expectedDocument = Object.assign(documentRecord, {
            url: '/rhombus/Untitled-ri2LMJy6XeZ6k2eKnphbtN'
        })
        const expectedDocuments = [expectedDocument]
        expect(transformDocuments(documents)).toEqual(expectedDocuments)
    })

    it('should parse document ids and filter invalid ids', () => {
        const stringIds =
            '900ca076-e4d0-4da6-b10a-4b23019eaa45,0,85a69cd6-baa4-48d4-a541-b53d12fdda1c'
        expect(parseDocumentIds(stringIds)).toEqual([
            '900ca076-e4d0-4da6-b10a-4b23019eaa45',
            '85a69cd6-baa4-48d4-a541-b53d12fdda1c'
        ])

        const arrayIds = [
            '900ca076-e4d0-4da6-b10a-4b23019eaa45',
            '0',
            '85a69cd6-baa4-48d4-a541-b53d12fdda1c'
        ]

        expect(parseDocumentIds(arrayIds)).toEqual([
            '900ca076-e4d0-4da6-b10a-4b23019eaa45',
            '85a69cd6-baa4-48d4-a541-b53d12fdda1c'
        ])
    })
})
