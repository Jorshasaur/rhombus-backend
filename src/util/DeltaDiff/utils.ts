import * as Delta from 'quill-delta'
import { BlockEmbed } from '../../interfaces/BlockEmbed'
import { CustomEmbeds } from '../../interfaces/CustomEmbeds'

export function getFirstBlockEmbed(delta: Delta): BlockEmbed | undefined {
    const insertOp = delta.ops!.find((op) => {
        return (
            op.insert != null &&
            typeof op.insert !== 'string' &&
            op.insert[CustomEmbeds.BlockEmbed] != null
        )
    })
    if (insertOp != null) {
        return insertOp.insert[CustomEmbeds.BlockEmbed]
    }
    return
}

export function getBlockEmbedByUuid(
    delta: Delta,
    uuid: string
): BlockEmbed | undefined {
    const insertOp = delta.ops!.find((op) => {
        return (
            op.insert != null &&
            typeof op.insert !== 'string' &&
            op.insert[CustomEmbeds.BlockEmbed] != null &&
            op.insert[CustomEmbeds.BlockEmbed].uuid === uuid
        )
    })
    if (insertOp != null) {
        return insertOp.insert[CustomEmbeds.BlockEmbed]
    }
    return
}
