import {
    SNAPSHOT_COEFFICIENT,
    DocumentRevision
} from '../../../models/DocumentRevision'
import { Revision } from './utils'
import { HookOptions } from '../../../interfaces/HookOptions'
import { QueueTaskPusher } from '../../../util/QueueManager'
import { THIRTY_SECONDS_IN_MS } from '../../../constants/Integers'
import * as Delta from 'quill-delta'

describe('DocumentRevision', () => {
    it('addSnapshot afterCreate hook should save snapshot every SNAPSHOT_COEFFICIENT times', async () => {
        const revision = new Revision(SNAPSHOT_COEFFICIENT * 2, {
            ops: [{ retain: 62 }, { insert: '@', attributes: { author: '9' } }]
        })
        const document = {
            saveSnapshot: jest.fn()
        }
        revision.$get = jest.fn(() => {
            return document
        })

        await DocumentRevision.addSnapshot(revision as any, {} as HookOptions)

        expect(QueueTaskPusher.getInstance().saveSnapshot).toBeCalled()
    })

    it('should emit an event when the title changes', async () => {
        const delta = {
            ops: [{ insert: 'HELLO WORLD', attributes: { author: 1 } }]
        }
        const revision = new Revision(10, delta)
        const document = {
            contents: jest.fn(() => {
                return {
                    delta: new Delta(delta)
                }
            }),
            save: jest.fn()
        }
        revision.$get = jest.fn(() => {
            return document
        })
        DocumentRevision.emitDocumentRenamed = jest.fn()
        await DocumentRevision.updateTitle(revision as any, {} as HookOptions)
        expect(DocumentRevision.emitDocumentRenamed).toHaveBeenCalled()
    })

    it('should not emit an event when the title does not change', async () => {
        const delta = {
            ops: [{ insert: 'HELLO WORLD', attributes: { author: 1 } }]
        }
        const revision = new Revision(10, delta)
        const document = {
            title: 'HELLO WORLD',
            contents: jest.fn(() => {
                return {
                    delta: new Delta(delta)
                }
            }),
            save: jest.fn()
        }
        revision.$get = jest.fn(() => {
            return document
        })
        DocumentRevision.emitDocumentRenamed = jest.fn()
        await DocumentRevision.updateTitle(revision as any, {} as HookOptions)
        expect(DocumentRevision.emitDocumentRenamed).not.toHaveBeenCalled()
    })

    it('emitDocumentUpdated afterCreate hook should ', async () => {
        const revision = new Revision(1, {
            ops: [{ retain: 62 }, { insert: '@', attributes: { author: '9' } }]
        })
        const documentId = '1234'
        const teamId = '5678'
        const document = {
            id: documentId,
            teamId
        }
        revision.$get = jest.fn(() => {
            return document
        })
        await DocumentRevision.emitDocumentUpdated(
            revision as any,
            {} as HookOptions
        )

        expect(QueueTaskPusher.getInstance().emitEventBusEvent).toBeCalledWith({
            debounce: THIRTY_SECONDS_IN_MS,
            eventData: { documentId, teamId },
            type: 'document.updated.v1'
        })
    })
})
