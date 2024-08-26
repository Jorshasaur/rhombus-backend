import {
    isValidDocumentDelta,
    isOperationComposable
} from '../../../util/OperationIsComposable'
import * as Delta from 'quill-delta'

describe('isValidDocumentDelta', () => {
    it('returns false if there are any retains or deletes in the delta', () => {
        const delta1 = new Delta([
            { insert: 'Title\n' },
            { insert: { embed: { id: 1 } } },
            { retain: 1 }
        ])

        const delta2 = new Delta([
            { insert: 'Title\n' },
            { delete: 1 },
            { insert: { embed: { id: 1 } } }
        ])

        expect(isValidDocumentDelta(delta1)).toBe(false)
        expect(isValidDocumentDelta(delta2)).toBe(false)
    })

    it('returns true if there are only insert operations', () => {
        const delta = new Delta([
            { insert: 'Title\n' },
            { insert: { embed: { id: 1 } } }
        ])

        expect(isValidDocumentDelta(delta)).toBe(true)
    })
})

describe('isOperationComposable', () => {
    it('returns true if new operation does not create invalid operations in document delta', () => {
        const delta = new Delta([
            { insert: 'Title\n' },
            { insert: { embed: { id: 1 } } }
        ])
        const contents = {
            delta,
            revision: 10
        }
        const operation1 = new Delta().retain(2).insert(' ')

        expect(isOperationComposable(contents, operation1)).toBe(true)
    })

    it('returns false if new operation creates invalid operations in document delta', () => {
        const delta = new Delta([
            { insert: 'Title\n' },
            { insert: { embed: { id: 1 } } }
        ])
        const contents = {
            delta,
            revision: 10
        }
        const operation1 = new Delta().retain(10).insert(' ')
        const operation2 = new Delta().delete(10)
        const operation3 = new Delta().retain(6).delete(3)

        expect(isOperationComposable(contents, operation1)).toBe(false)
        expect(isOperationComposable(contents, operation2)).toBe(false)
        expect(isOperationComposable(contents, operation3)).toBe(false)
    })
})
