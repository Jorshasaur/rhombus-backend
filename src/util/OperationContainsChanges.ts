import * as Delta from 'quill-delta'
import { DeltaOperations } from '../interfaces/DeltaOperations'
import { CustomEmbeds } from '../interfaces/CustomEmbeds'
import { getFirstBlockEmbed, getBlockEmbedByUuid } from './DeltaDiff/utils'
import { diffEmbed } from './DeltaDiff/Embed'

export function operationContainsChanges(operation: DeltaOperations) {
    const ops = operation instanceof Array ? operation : operation.ops

    return ops.some((op) => !!op.delete || !!op.insert)
}

function isAddCommentOperation(operation: Delta) {
    const ops = operation.ops!
    if (ops.length === 3) {
        const firstOp = ops[0].retain
        const secondOp = ops[1].insert
        const thirdOp = ops[2].delete

        return (
            firstOp != null &&
            secondOp != null &&
            thirdOp === 1 &&
            secondOp[CustomEmbeds.BlockEmbed] != null &&
            secondOp[CustomEmbeds.BlockEmbed].embedData != null &&
            secondOp[CustomEmbeds.BlockEmbed].embedData.threadIds != null
        )
    }
    return false
}

export function operationContainsOnlyCommentChange(
    documentDelta: Delta,
    operation: Delta
) {
    if (!isAddCommentOperation(operation)) {
        return false
    }

    const newEmbed = getFirstBlockEmbed(operation)
    if (newEmbed == null) {
        return false
    }

    const oldEmbed = getBlockEmbedByUuid(documentDelta, newEmbed.uuid)
    if (oldEmbed == null) {
        return false
    }

    const diffResult = diffEmbed(oldEmbed, newEmbed)

    if (
        diffResult != null &&
        diffResult.embedData != null &&
        diffResult.embedData.threadIds != null &&
        Object.keys(diffResult).length === 1 &&
        Object.keys(diffResult.embedData).length === 1
    ) {
        return true
    }
    return false
}
