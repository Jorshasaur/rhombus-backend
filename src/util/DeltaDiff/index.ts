import * as Delta from 'quill-delta'
import * as equal from 'deep-equal'
import wordDiff from './WordDiff'

export const START_RHOMBUS_EMBED_TOKEN = '__startRhombusEmbed'
export const END_RHOMBUS_EMBED_TOKEN = '__endRhombusEmbed'

const REPLACE_ID_REGEX = /[^a-zA-Z0-9_]+/g

const NULL_CHARACTER = String.fromCharCode(0)

enum DiffOp {
    INSERT = 1,
    EQUAL = 0,
    DELETE = -1
}

type DiffResult = [DiffOp, string]

interface Component {
    count: number
    added: boolean
    removed: boolean
}

interface ValueComponent extends Component {
    value: string
}

type GetEmbedId = (type: string, op: Delta.DeltaOperation) => string | undefined

function getStrings(self: Delta, other: Delta, getEmbedId?: GetEmbedId) {
    const embedIds: string[] = []
    const useGetEmbedId = typeof getEmbedId === 'function'
    const strings = [self, other].map(function(delta: Delta) {
        return delta
            .map(function(op: Delta.DeltaOperation) {
                if (op.insert != null) {
                    if (typeof op.insert === 'string') {
                        return op.insert
                    } else {
                        if (useGetEmbedId) {
                            const embedType = Object.keys(op.insert)[0]
                            let embedId = getEmbedId!(embedType, op)
                            if (embedId != null) {
                                embedId = embedId.replace(REPLACE_ID_REGEX, '')
                                embedIds.push(embedId)
                                return `${START_RHOMBUS_EMBED_TOKEN}${embedId}${END_RHOMBUS_EMBED_TOKEN}`
                            } else {
                                return NULL_CHARACTER
                            }
                        } else {
                            return NULL_CHARACTER
                        }
                    }
                }
                const prep = delta === other ? 'on' : 'with'
                throw new Error('diff() called ' + prep + ' non-document')
            })
            .join('')
    })
    return {
        strings,
        embedIds
    }
}

function mapDiffResult(wordDiffResult: ValueComponent[], embedIds: string[]) {
    return wordDiffResult.map(
        (item): DiffResult => {
            if (embedIds.indexOf(item.value) > -1) {
                item.value = NULL_CHARACTER
            }

            if (item.added) {
                return [DiffOp.INSERT, item.value]
            } else if (item.removed) {
                return [DiffOp.DELETE, item.value]
            } else {
                return [DiffOp.EQUAL, item.value]
            }
        }
    )
}

// Based on Delta.diff function
export default function diff(
    self: Delta,
    other: Delta,
    getEmbedId?: GetEmbedId
) {
    if (self.ops === other.ops) {
        return new Delta()
    }

    const { strings, embedIds } = getStrings(self, other, getEmbedId)

    const retDelta = new Delta()

    const wordDiffResult = wordDiff.diff(strings[0], strings[1])

    const diffResult = mapDiffResult(wordDiffResult, embedIds)

    const thisIter = Delta.Op.iterator(self.ops!)
    const otherIter = Delta.Op.iterator(other.ops!)

    diffResult.forEach((component) => {
        let length = component[1].length
        while (length > 0) {
            let opLength = 0
            switch (component[0]) {
                case DiffOp.INSERT:
                    opLength = Math.min(otherIter.peekLength(), length)
                    retDelta.push(otherIter.next(opLength))
                    break
                case DiffOp.DELETE:
                    opLength = Math.min(length, thisIter.peekLength())
                    thisIter.next(opLength)
                    retDelta.delete(opLength)
                    break
                case DiffOp.EQUAL:
                    opLength = Math.min(
                        thisIter.peekLength(),
                        otherIter.peekLength(),
                        length
                    )
                    const thisOp = thisIter.next(opLength)
                    const otherOp = otherIter.next(opLength)
                    if (equal(thisOp.insert, otherOp.insert)) {
                        retDelta.retain(
                            opLength,
                            Delta.AttributeMap.diff(
                                thisOp.attributes,
                                otherOp.attributes
                            )
                        )
                    } else {
                        retDelta.push(otherOp).delete(opLength)
                    }
                    break
                default:
                    break
            }
            length -= opLength
        }
    })
    return retDelta.chop()
}
