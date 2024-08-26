import * as Delta from 'quill-delta'
import { CustomEmbeds } from '../interfaces/CustomEmbeds'

export enum LineType {
    LINE = 1,
    EMBED = 2
}

export interface Line {
    type: LineType
    delta: Delta
    attributes: Delta.AttributeMap | undefined
}

export default function eachLine(
    delta: Delta,
    predicate: (line: Line, index: number) => boolean | void,
    newline = '\n'
): void {
    const iter = Delta.Op.iterator(delta.ops!)
    let line = new Delta()
    let i = 0
    while (iter.hasNext()) {
        if (iter.peekType() !== 'insert') {
            return
        }
        const thisOp = iter.peek()
        if (
            typeof thisOp.insert === 'object' &&
            (thisOp.insert[CustomEmbeds.BlockEmbed] ||
                thisOp.insert[CustomEmbeds.PaneEmbed])
        ) {
            line.push(iter.next())
            if (
                predicate(
                    { delta: line, attributes: {}, type: LineType.EMBED },
                    i
                ) === false
            ) {
                return
            }
            i += 1
            line = new Delta()
            continue
        }

        const start = Delta.Op.length(thisOp) - iter.peekLength()
        const index =
            typeof thisOp.insert === 'string'
                ? thisOp.insert.indexOf(newline, start) - start
                : -1
        if (index < 0) {
            line.push(iter.next())
        } else if (index > 0) {
            line.push(iter.next(index))
        } else {
            if (
                predicate(
                    {
                        delta: line,
                        attributes: iter.next(1).attributes || {},
                        type: LineType.LINE
                    },
                    i
                ) === false
            ) {
                return
            }
            i += 1
            line = new Delta()
        }
    }
    if (line.length() > 0) {
        predicate({ delta: line, attributes: {}, type: LineType.LINE }, i)
    }
}
