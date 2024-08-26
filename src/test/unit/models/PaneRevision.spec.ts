import * as json1 from 'ot-json1'
import { isPaneMentionOperation } from '../../../models/PaneRevision'

describe('PaneRevision', () => {
    describe('isPaneMentionOperation', () => {
        it('returns true when operation contains mention', () => {
            const delta = {
                ops: [
                    {
                        retain: 5
                    },
                    {
                        insert: {
                            mention: {
                                id: 1,
                                userId: 1,
                                name: 'Test user',
                                email: 'test@invisionapp.com'
                            }
                        },
                        attributes: {
                            author: 1
                        }
                    }
                ]
            }
            const operation = json1.editOp(
                ['elements', 1, 'elements', 0, 'value'],
                'rich-text',
                delta
            )
            expect(isPaneMentionOperation(operation)).toBeTruthy()
        })

        it('returns false when operation does not contain mention', () => {
            const operation = json1.insertOp(
                ['elements', 1, 'elements', 0, 'value'],
                {}
            )
            expect(isPaneMentionOperation(operation)).toBeFalsy()
        })
    })
})
