import { PaneElement, PaneList } from '../interfaces/PaneContents'
import { Pane } from '../models/Pane'
import { isEqual } from 'lodash'

export async function markUpdates(
    paneId: string,
    teamId: string,
    revision: number
) {
    const pane = await Pane.findPane(paneId, teamId)
    if (!pane) {
        return
    }

    const latest = await pane!.contents()
    if (latest.revision === revision) {
        return
    }
    const old = await pane!.contents({}, revision)

    const rows = latest.contents.elements as PaneList[]
    const oldPane = old.contents
    rows.map((row: PaneList, rowIndex: number) => {
        const columns = row.elements as PaneElement[]
        columns.map((cell: PaneElement, cellIndex: number) => {
            const oldPaneRow = oldPane.elements[rowIndex] as PaneList
            if (!oldPaneRow || !isEqual(cell, oldPaneRow.elements[cellIndex])) {
                cell.hasUpdates = true
            }
        })
    })

    return latest.contents
}
