import * as Delta from 'quill-delta'
import { DocumentContents } from 'src/interfaces/DocumentContents'

export function isOperationComposable(
    documentContents: DocumentContents,
    operation: Delta
) {
    const contents = documentContents.delta.compose(operation)
    return isValidDocumentDelta(contents)
}

export function isValidDocumentDelta(delta: Delta) {
    return getInvalidOperation(delta) == null
}

function getInvalidOperation(delta: Delta) {
    return delta.ops!.find((op) => op.insert == null)
}
