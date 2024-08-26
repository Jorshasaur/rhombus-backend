import * as json1 from 'ot-json1'
import * as Delta from 'quill-delta'
import {
    Pane as IPane,
    PaneElementType
} from '../../../interfaces/PaneContents'
import { Pane } from '../../../models/Pane'
import { PaneRevision } from '../../../models/PaneRevision'

function createInitialText() {
    return {
        type: PaneElementType.TEXT,
        id: expect.any(String),
        value: new Delta([
            {
                insert: '\n',
                attributes: { id: expect.any(String) }
            }
        ])
    }
}

function createInitialRow() {
    return {
        id: expect.any(String),
        elements: [createInitialText(), createInitialText()]
    }
}

describe('Pane', () => {
    const options = {
        transaction: {} as any
    }

    it('should correctly get contents of a snapshot revision', async () => {
        PaneRevision.findOne = jest.fn(() => {
            return {
                revision: 10,
                snapshot: { title: 'hello im something in JSON1' }
            }
        })
        const result = await Pane.prototype.contents(options, 10)
        expect(result).toEqual({
            revision: 10,
            contents: { title: 'hello im something in JSON1' }
        })
        const secondResult = await Pane.prototype.contents(options)
        expect(secondResult).toEqual({
            revision: 10,
            contents: { title: 'hello im something in JSON1' }
        })
    })
    it('should correctly apply revisions to a snapshot', async () => {
        let firstRevision = true
        const middleRevision = {
            revision: 11,
            operation: json1.insertOp(['id'], '12345')
        }
        const lastRevision = {
            revision: 12,
            operation: json1.replaceOp(
                ['title'],
                'hello im something in JSON1',
                'hello im modified JSON1'
            )
        }
        PaneRevision.findOne = jest.fn(() => {
            if (firstRevision) {
                firstRevision = false
                return {
                    revision: 10,
                    snapshot: { title: 'hello im something in JSON1' }
                }
            } else {
                return lastRevision
            }
        })
        Pane.prototype.$get = jest.fn((options) => {
            return Promise.resolve([middleRevision, lastRevision])
        })
        const result = await Pane.prototype.contents(options, 12)
        expect(result).toEqual({
            contents: { title: 'hello im modified JSON1', id: '12345' },
            revision: 12
        })
        firstRevision = true
        const secondResult = await Pane.prototype.contents(options)
        expect(secondResult).toEqual({
            contents: { title: 'hello im modified JSON1', id: '12345' },
            revision: 12
        })
    })
    it('should correctly get revisions with Delta ops', async () => {
        let firstRevision = true
        const middleRevision = {
            revision: 11,
            operation: json1.insertOp(['id'], '12345')
        }
        const lastRevision = {
            revision: 12,
            operation: json1.editOp(
                ['title'],
                'rich-text',
                new Delta().insert('New text from delta')
            )
        }
        PaneRevision.findOne = jest.fn(() => {
            if (firstRevision) {
                firstRevision = false
                return {
                    revision: 10,
                    snapshot: { title: 'hello im something in JSON1' }
                }
            } else {
                return lastRevision
            }
        })
        Pane.prototype.$get = jest.fn((options) => {
            return Promise.resolve([middleRevision, lastRevision])
        })
        const result = await Pane.prototype.contents(options, 12)
        expect(result).toEqual({
            contents: {
                title: { ops: [{ insert: 'New text from delta' }] },
                id: '12345'
            },
            revision: 12
        })
    })
    it('should correctly create an initial revision', () => {
        let initialRevision
        const instance = {
            $create: jest.fn((type: string, revision: any) => {
                initialRevision = json1.type.apply({}, revision.operation)
            }),
            id: 'hello-new-pane'
        }
        Pane.addInitialRevision(instance as any, options as any)
        expect(initialRevision).toEqual({
            elements: [createInitialRow(), createInitialRow()],
            id: instance.id,
            metadata: {
                columnSizes: {
                    0: 50,
                    1: 50
                }
            },
            viewType: 'table'
        })
    })
    it('should send the correct contents with a single revision', async () => {
        const initialRevision = {
            revision: 0,
            operation: [
                ['elements', { i: [] }],
                ['id', { i: '12345' }],
                ['viewType', { i: 'table' }]
            ]
        }
        let firstRevision = true
        PaneRevision.findOne = jest.fn(() => {
            if (firstRevision) {
                firstRevision = false
                return Promise.resolve()
            }
            return Promise.resolve(initialRevision)
        })
        Pane.prototype.$get = jest.fn(() => {
            return Promise.resolve([initialRevision])
        })
        const contents = await Pane.prototype.contents()
        expect(contents.revision).toEqual(0)
        expect(contents.contents).toEqual({
            elements: [],
            id: '12345',
            viewType: 'table'
        })
    })
    it('should duplicate a pane correctly', async () => {
        const originalPaneId = '12345-aa-bb-cc'
        const clonePaneId = 'aabb-cc-dddd-eee'
        const initialRevision = {
            revision: 0,
            operation: [
                ['elements', { i: [] }],
                ['id', { i: '12345' }],
                ['viewType', { i: 'table' }]
            ],
            snapshot: {},
            save: jest.fn()
        }
        const jsonDocument = {
            elements: [
                {
                    id: 'aa-bb-cc',
                    elements: []
                }
            ],
            id: originalPaneId,
            viewType: 'table'
        }
        Pane.prototype.contents = jest.fn(() => {
            return Promise.resolve({
                contents: jsonDocument,
                revision: 0
            })
        })
        PaneRevision.findOne = jest.fn(() => {
            return Promise.resolve(initialRevision)
        })
        Pane.create = jest.fn(() => {
            return Promise.resolve({
                id: clonePaneId
            })
        })
        Pane.prototype.id = originalPaneId
        Pane.prototype.title = 'original title'
        Pane.prototype.teamId = 'original team'
        const result = await Pane.prototype.duplicate(
            'new-document-id',
            'new-user',
            options.transaction
        )
        expect(Pane.create).toHaveBeenCalledWith(
            {
                title: 'original title',
                teamId: 'original team',
                owningDocumentId: 'new-document-id',
                owningUserId: 'new-user'
            },
            { transaction: options.transaction }
        )
        expect(Pane.prototype.contents).toHaveBeenCalledTimes(1)
        expect(PaneRevision.findOne).toHaveBeenCalledWith({
            where: {
                paneId: clonePaneId,
                revision: 0
            },
            transaction: options.transaction
        })
        expect(result).toEqual(clonePaneId)
        expect((initialRevision.snapshot as IPane).id).toEqual(clonePaneId)
    })
})
