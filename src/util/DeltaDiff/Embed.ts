import { diff } from 'deep-object-diff'
import { BlockEmbed } from '../../interfaces/BlockEmbed'

export function diffEmbed(oldEmbed: BlockEmbed, newEmbed: BlockEmbed) {
    return diff<BlockEmbed>(oldEmbed, newEmbed)
}
