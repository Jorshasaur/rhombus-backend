import * as DeltaUtils from '../../../util/DeltaUtils'
import * as Delta from 'quill-delta'
import { Pane } from '../../../models/Pane'

describe('DeltaUtils', () => {
    it('should removeNonInsertOperations', () => {
        const delta = new Delta()
            .insert('Lorem ipsum')
            .retain(12)
            .delete(1)

        expect(DeltaUtils.removeNonInsertOperations(delta)).toEqual({
            ops: [{ insert: 'Lorem ipsum' }]
        })
    })
    it('should mark panes as updated', () => {
        const changedPane = '123456'
        const normalPane = '7890'
        const contents = {
            revision: 30,
            delta: new Delta()
                .insert({
                    'pane-embed': {
                        embedData: {
                            pane: changedPane
                        }
                    }
                })
                .insert({
                    'pane-embed': {
                        embedData: {
                            pane: normalPane
                        }
                    }
                })
        }
        const panes = { '123456': {} as Pane }
        const marked = DeltaUtils.markPaneDeltas(contents, panes)
        expect(marked.delta.ops[0].insert['pane-embed'].hasUpdates).toBeTruthy()
        expect(marked.delta.ops[1].insert['pane-embed'].hasUpdates).toBeFalsy()
    })
})
