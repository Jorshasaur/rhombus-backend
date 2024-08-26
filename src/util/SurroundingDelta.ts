import * as Delta from 'quill-delta'
import eachLine, { LineType, Line } from './EachLine'
import { CustomEmbeds } from '../interfaces/CustomEmbeds'

export function getSurroundingDelta(
    documentDelta: Delta.DeltaStatic,
    retain: number
) {
    let len = 0
    let prevLine: Line | undefined
    let currentLine: Line | undefined
    let nextLine: Line | undefined
    let found = false

    eachLine(documentDelta, (line) => {
        if (found) {
            nextLine = line
            return false
        }

        line.delta.forEach(({ insert }) => {
            if (len === retain) {
                currentLine = line
                found = true
                return false
            }
            if (typeof insert === 'string') {
                len += insert.length
            } else {
                len += 1
            }
            return true
        })
        len += 1

        if (!found) {
            prevLine = line
        }

        return true
    })

    if (!found) {
        return
    }

    return getLineDelta(nextLine).compose(
        getLineDelta(currentLine).compose(getLineDelta(prevLine))
    )
}

function getLineDelta(line?: Line) {
    if (!line) {
        return new Delta()
    }

    if (line.type === LineType.EMBED) {
        return line.delta
    }

    return line.delta.insert('\n', line.attributes)
}

export function getPaneSurroundingDelta(
    documentDelta: Delta.DeltaStatic,
    paneId: string
) {
    let prevLine: Line | undefined
    let currentLine: Line | undefined
    let nextLine: Line | undefined
    let found = false

    eachLine(documentDelta, (line) => {
        if (found) {
            nextLine = line
            return false
        }

        if (line.type === LineType.EMBED) {
            const embed = line.delta.ops![0].insert
            if (
                embed[CustomEmbeds.PaneEmbed] &&
                embed[CustomEmbeds.PaneEmbed].embedData.pane === paneId
            ) {
                currentLine = line
                found = true
            }
        }

        if (!found) {
            prevLine = line
        }

        return true
    })

    if (!found) {
        return
    }

    return getLineDelta(nextLine).compose(
        getLineDelta(currentLine).compose(getLineDelta(prevLine))
    )
}
