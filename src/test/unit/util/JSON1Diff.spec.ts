import { ContentsOptions } from '../../../models/Document'
import {
    PaneElementType,
    PaneViewType,
    PaneList,
    PaneElement,
    PaneImage
} from '../../../interfaces/PaneContents'
import { markUpdates } from '../../../util/JSON1Diff'
import { Pane } from '../../../models/Pane'

const paneOne = {
    viewType: PaneViewType.TABLE,
    id: 'aabbcc',
    elements: [
        {
            id: 'aabb',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 1234,
                        id: 'image-1',
                        width: 333
                    }
                }
            ]
        }
    ]
}

const paneTwo = {
    viewType: PaneViewType.TABLE,
    id: 'aabbcc',
    elements: [
        {
            id: 'aabb',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-1',
                        width: 35
                    }
                }
            ]
        }
    ]
}

const paneThree = {
    viewType: PaneViewType.TABLE,
    id: 'aabbcc',
    elements: [
        {
            id: 'aabb',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 1234,
                        id: 'image-1',
                        width: 333
                    }
                }
            ]
        }
    ]
}

const paneFour = {
    viewType: PaneViewType.TABLE,
    id: 'aabbcc',
    elements: [
        {
            id: 'aabb',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 1234,
                        id: 'image-1',
                        width: 333
                    }
                },
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-2',
                        width: 35
                    }
                },
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-3',
                        width: 35
                    }
                }
            ]
        }
    ]
}

const paneFive = {
    viewType: PaneViewType.TABLE,
    id: 'aabbcc',
    elements: [
        {
            id: 'aabb',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 1234,
                        id: 'image-3',
                        width: 333
                    }
                },
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-1',
                        width: 35
                    }
                },
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-2',
                        width: 35
                    }
                }
            ]
        }
    ]
}

const paneSix = {
    viewType: PaneViewType.TABLE,
    id: 'aabbcc',
    elements: [
        {
            id: 'aabb',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 1234,
                        id: 'image-3',
                        width: 333
                    }
                },
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-1',
                        width: 35
                    }
                },
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-2',
                        width: 35
                    }
                }
            ]
        }
    ]
}

const paneSeven = {
    viewType: PaneViewType.TABLE,
    id: 'aabbcc',
    elements: [
        {
            id: 'aabb',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 1234,
                        id: 'image-3',
                        width: 333
                    }
                },
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-2',
                        width: 35
                    }
                }
            ]
        },
        {
            id: 'aabbcc',
            elements: [
                {
                    type: PaneElementType.IMAGE,
                    value: {
                        height: 10,
                        id: 'image-1',
                        width: 35
                    }
                }
            ]
        }
    ]
}

let firstPane
let secondPane

Pane.findPane = jest.fn(() => {
    return {
        contents: jest.fn(
            async (options: ContentsOptions, atRevision?: number) => {
                if (atRevision) {
                    return {
                        revision: atRevision,
                        contents: Object.assign({}, firstPane)
                    }
                } else {
                    return {
                        revision: 100,
                        contents: Object.assign({}, secondPane)
                    }
                }
            }
        )
    } as any
})

describe('JSON1Slice Tests', () => {
    it('should get diffs between two revision contents', async () => {
        firstPane = paneOne
        secondPane = paneTwo
        const updates = await markUpdates('aaa', 'testTeam', 10)
        expect(
            ((updates.elements[0] as PaneList).elements[0] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
        expect(
            ((updates.elements[0] as PaneList).elements[0] as PaneImage).value
                .height
        ).toEqual(10)
        expect(
            ((updates.elements[0] as PaneList).elements[0] as PaneImage).value
                .width
        ).toEqual(35)
    })
    it('should get diffs between two revision contents with multiple changes', async () => {
        firstPane = paneThree
        secondPane = paneFour
        const updates = await markUpdates('aabbcc', 'testTeam', 10)
        expect(
            ((updates.elements[0] as PaneList).elements[0] as PaneImage)
                .hasUpdates
        ).toBeFalsy()
        expect(
            ((updates.elements[0] as PaneList).elements[1] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
        expect(
            ((updates.elements[0] as PaneList).elements[2] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
    })
    it('should get diffs between two revision contents with move changes', async () => {
        firstPane = paneFour
        secondPane = paneFive
        const updates = await markUpdates('bbccdd', 'testTeam', 10)
        expect(
            ((updates.elements[0] as PaneList).elements[0] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
        expect(
            ((updates.elements[0] as PaneList).elements[1] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
        expect(
            ((updates.elements[0] as PaneList).elements[2] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
    })
    it('should get diffs between two revision contents with list move changes', async () => {
        firstPane = paneSix
        secondPane = paneSeven
        const updates = await markUpdates('aabbcc', 'testTeam', 10)
        expect(
            ((updates.elements[0] as PaneList).elements[0] as PaneImage)
                .hasUpdates
        ).toBeFalsy()
        expect(
            ((updates.elements[0] as PaneList).elements[1] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
        expect(
            ((updates.elements[1] as PaneList).elements[0] as PaneImage)
                .hasUpdates
        ).toBeTruthy()
    })
})
