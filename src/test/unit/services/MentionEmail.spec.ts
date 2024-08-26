import * as Delta from 'quill-delta'
import * as json1 from 'ot-json1'
import { getPaneMention } from '../../../services/MentionEmail'
import { DEFAULT_REQUEST_USER_ID, DEFAULT_REQUEST_TEAM_ID } from '../../utils'
import { PaneRevision } from '../../../models/PaneRevision'
import { createInitialRow, Pane } from '../../../models/Pane'
import {
    PaneViewType,
    PaneList,
    PaneElement
} from '../../../interfaces/PaneContents'

function getDocumentOpsWithPane() {
    return [
        {
            insert: 'Untitled'
        },
        {
            attributes: {
                header: 1,
                id: 'cjftvg0x200002yqkrpbsqnrc'
            },
            insert: '\n'
        },
        {
            insert: {
                'pane-embed': {
                    embedData: {
                        pane: 'pane-id'
                    }
                }
            },
            attributes: {
                author: 1
            }
        },
        {
            insert: {
                'block-embed': {
                    embedData: {
                        service: 'image'
                    }
                }
            }
        },
        {
            insert: 'A'
        },
        {
            attributes: {
                author: '9',
                id: 'cjftvg80r00053i5oyhma4dvy'
            },
            insert: '\n'
        }
    ]
}

function getMention() {
    return {
        id: 2,
        userId: 2,
        name: 'Test user',
        email: 'test@invisionapp.com'
    }
}

function getMentionDelta() {
    return new Delta([
        {
            retain: 5
        },
        {
            insert: {
                mention: getMention()
            },
            attributes: {
                author: 1
            }
        }
    ])
}

function getPaneRevision() {
    const operation = json1.editOp(
        ['elements', 0, 'elements', 0, 'value'],
        'rich-text',
        getMentionDelta()
    )

    return {
        operation
    }
}

function getPaneContents() {
    const table = {
        elements: [createInitialRow(), createInitialRow()],
        viewType: PaneViewType.TABLE
    }
    const mentionDelta = getMentionDelta()
    table.elements[0].elements[0].value = new Delta()
        .insert('Test ')
        .compose(mentionDelta)
    return table
}

describe('MentionEmail', () => {
    describe('getPaneMention', () => {
        let document: any
        let paneId = 'pane-id'
        let revision = 1
        let paneRevision: any
        let paneContents: any
        let documentContents: Delta

        beforeEach(() => {
            documentContents = new Delta(getDocumentOpsWithPane())
            document = {
                id: '1',
                title: 'Untitled',
                contents() {
                    return Promise.resolve({
                        revision: 1,
                        delta: documentContents
                    })
                }
            }
            paneRevision = getPaneRevision()
            paneContents = getPaneContents()
        })

        it('should get pane mention and surrounding delta', async () => {
            jest.spyOn(Pane, 'findOne').mockImplementationOnce(() => {
                return Promise.resolve({
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            contents: paneContents
                        })
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([] as PaneRevision[])
                    },
                    getRevision() {
                        return Promise.resolve(paneRevision)
                    }
                }) as any
            })

            const {
                mention,
                delta,
                paneContents: updatedPaneContents
            } = await getPaneMention(
                document,
                DEFAULT_REQUEST_USER_ID,
                DEFAULT_REQUEST_TEAM_ID,
                paneId,
                revision
            )
            const paneList = updatedPaneContents.elements[0] as PaneList
            const firstCell = paneList.elements[0] as PaneElement

            expect(mention).toEqual(mention)
            expect(firstCell.hasUpdates).toBeTruthy()
            expect(delta).toEqual(
                new Delta([
                    documentContents.ops[0],
                    documentContents.ops[1],
                    documentContents.ops[2],
                    documentContents.ops[3]
                ])
            )
        })

        it('should transform mention revision', async () => {
            jest.spyOn(Pane, 'findOne').mockImplementationOnce(() => {
                return Promise.resolve({
                    contents() {
                        return Promise.resolve({
                            revision: 1,
                            contents: paneContents
                        })
                    },
                    getRevisionsAfterRevision() {
                        return Promise.resolve([
                            {
                                operation: json1.moveOp(
                                    ['elements', 0, 'elements', 0],
                                    ['elements', 1, 'elements', 0]
                                )
                            }
                        ])
                    },
                    getRevision() {
                        return Promise.resolve(paneRevision)
                    }
                }) as any
            })

            const { paneContents: updatedPaneContents } = await getPaneMention(
                document,
                DEFAULT_REQUEST_USER_ID,
                DEFAULT_REQUEST_TEAM_ID,
                paneId,
                revision
            )
            const secondPaneList = updatedPaneContents.elements[1] as PaneList
            const cell = secondPaneList.elements[0] as PaneElement

            expect(cell.hasUpdates).toBeTruthy()
        })
    })
})
