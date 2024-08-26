import * as Delta from 'quill-delta'
import { Document } from '../models/Document'
import { Pane } from '../models/Pane'

interface SliceLine {
    delta: Delta.DeltaStatic
    attributes: Delta.StringMap
    isPaneEmbed: boolean
}

export interface Slice {
    lines: SliceLine[]
}

function separateIntoLines(contents: Delta.DeltaStatic) {
    let lines: SliceLine[] = []
    contents.eachLine((delta, attributes, index) => {
        // We never want to include document headers
        if (index !== 0 && delta.ops) {
            let currentLine: Delta.DeltaOperation[] = []
            // We still want empty lines saved so we can show important lines properly
            if (delta.ops.length === 0) {
                currentLine.push({ insert: '\n', attributes })
            }
            delta.ops.forEach((value: Delta.DeltaOperation, index: number) => {
                if (
                    typeof value.insert === 'object' &&
                    (value.insert['pane-embed'] || value.insert['block-embed'])
                ) {
                    const isPaneEmbed =
                        typeof value.insert['pane-embed'] === 'object'
                    // Theres a pane or embed so we need to save the old stuff on a line
                    if (currentLine.length > 0) {
                        lines.push({
                            delta: new Delta(currentLine),
                            attributes,
                            isPaneEmbed
                        })
                    }
                    // Add the embed to its own line
                    lines.push({
                        delta: new Delta({ ops: [value] }),
                        attributes,
                        isPaneEmbed
                    })
                    // Make a new line for the next stuff
                    currentLine = []
                } else {
                    // Add to the current line
                    currentLine.push(value)
                }
            })
            // If there's a line left add it in
            if (currentLine.length > 0) {
                lines.push({
                    delta: new Delta(currentLine),
                    attributes,
                    isPaneEmbed: false
                })
            }
        }
    })

    return lines
}

export function isUpdatedOp(op: Delta.DeltaOperation) {
    if (op.attributes && op.attributes.added) {
        if (op.insert === '\n') {
            if (op.attributes.list || op.attributes.headers) {
                return true
            } else {
                return false
            }
        }
        return true
    }
    return false
}

/**
 * A function to convert some ops into slices grouped by what has changed from previous revisions.
 *
 * Steps:
 * 1. Go through the lines and figure out if anything on those lines has changed.
 * 2. If something has changed, then store that line and the line before and after it (if they exist).
 * 3. After we've got all of those lines, slice them if there are more than 2 unchanged lines together.
 * @param contents
 */
export function getUpdatedSlicesFromContents(
    contents: Delta.DeltaStatic
): Slice[] {
    let slices: Slice[] = []
    if (!contents.ops) {
        return slices
    }
    let lines: SliceLine[] = separateIntoLines(contents)
    let importantLines: SliceLine[] = []
    lines.forEach((line, index) => {
        if (line.delta.ops) {
            line.delta.ops.find((op) => {
                // We care about the line if its marked as added
                if (isUpdatedOp(op)) {
                    // If the delta is a Pane, we don't want slices around it.  We also don't want a slice thats a pane

                    // Get the previous line, if there is one
                    if (index !== 0 && !line.isPaneEmbed) {
                        const previousLine = lines[index - 1]
                        if (!previousLine.isPaneEmbed) {
                            importantLines[index - 1] = previousLine
                        }
                    }
                    importantLines[index] = line

                    // Get the next line if there is one
                    if (index !== lines.length - 1 && !line.isPaneEmbed) {
                        const nextLine = lines[index + 1]
                        if (!nextLine.isPaneEmbed) {
                            importantLines[index + 1] = lines[index + 1]
                        }
                    }
                    return true
                }
                return false
            })
        }
    })
    let currentSlice: Slice = {
        lines: []
    }
    // If there's nothing special here, then just bail
    if (importantLines.length === 0) {
        return slices
    }
    importantLines.forEach((line, index) => {
        // If the line is null, it doesn't have anything to do with an update so we don't care
        if (line !== null) {
            // The previous line should either be an unchanged line or another changed line
            // If its neither of those then it should be something we split on
            let previousLineIndex = index - 1
            if (previousLineIndex > -1 && !importantLines[previousLineIndex]) {
                if (currentSlice.lines.length > 0) {
                    slices.push(currentSlice)
                }
                // When we split we make a new slice for the next group of lines
                currentSlice = {
                    lines: []
                }
            }
            currentSlice.lines.push(line)
        }
    })
    slices.push(currentSlice)
    return slices
}

export function composeSlices(slices: Slice[]) {
    return slices.map((slice) => {
        return slice.lines.reduce((ret, line) => {
            let insert = line.delta.ops![0].insert !== '\n' ? '\n' : ''
            return new Delta()
                .insert(insert, line.attributes)
                .compose(line.delta)
                .compose(ret)
        }, new Delta())
    })
}

/**
 *
 * @param slices The slices to get authors for
 * @returns {number[][]} A list of authorId lists for each slice
 */
export function getSlicesAuthorIds(slices: Delta.DeltaStatic[]): number[][] {
    return slices.map((slice: Delta.DeltaStatic, i) => {
        return slice.reduce((sliceRet: number[], op) => {
            if (
                op.attributes != null &&
                op.attributes.added === true &&
                op.attributes.author != null
            ) {
                const authorId = parseInt(op.attributes.author, 10)
                if (sliceRet.indexOf(authorId) === -1) {
                    sliceRet.push(authorId)
                }
            }
            return sliceRet
        }, [])
    })
}

export async function getSlices(
    document: Document,
    revision: number,
    panes?: { [paneId: string]: Pane | undefined }
) {
    // get diff
    const diffDocContents = await document.getDiff(revision, panes)
    // get slices
    const slices = getUpdatedSlicesFromContents(diffDocContents)
    if (slices.length < 1) {
        return
    }

    // compose slices
    return composeSlices(slices)
}
