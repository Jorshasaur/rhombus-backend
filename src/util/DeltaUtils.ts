import * as Delta from 'quill-delta'
import { DocumentContents } from '../interfaces/DocumentContents'
import { Pane } from '../models/Pane'

export function removeNonInsertOperations(delta: Delta) {
    return new Delta(delta.filter((op) => op.insert != null))
}

export function markPaneDeltas(
    contents: DocumentContents,
    panes: { [paneId: string]: Pane | undefined }
) {
    if (contents.delta.ops && contents.delta.ops.length > 0) {
        const ops = contents.delta.ops
        ops.forEach((op: Delta.DeltaOperation, index: number) => {
            if (op.insert && op.insert['pane-embed']) {
                const paneId = op.insert['pane-embed'].embedData.pane
                if (paneId && panes[paneId]) {
                    op.insert['pane-embed'].hasUpdates = true
                }
            }
        })
    }
    return contents
}
