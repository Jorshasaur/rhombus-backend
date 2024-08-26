import { DeltaStatic } from 'quill-delta'

export default function deltaToText(delta: DeltaStatic) {
    return delta.reduce((text, op) => {
        const insertOp = op.insert

        if (!insertOp) {
            return text
        } else if (typeof insertOp === 'string') {
            return text + insertOp
        } else if (insertOp.mention) {
            return text + `@${insertOp.mention.name}`
        } else if (insertOp['document-mention']) {
            return text + '@Doc'
        } else {
            return text
        }
    }, '')
}
