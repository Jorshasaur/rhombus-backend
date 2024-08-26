import { FREEHAND_SIGNIFICANTLY_CHANGED } from '../../../../../../src/event-bus/consumer/FreehandSignificantlyChanged'
import { DocumentRevision } from '../../../../../../src/models/DocumentRevision'
import { onFreehandSignificantlyChanged } from '../../../../../../src/util/QueueManager/QueueTasks/FreehandUpdateTask'
import SocketManager from '../../../../../../src/util/SocketManager'

const mockFreehandSignificantlyChanged = {
    type: FREEHAND_SIGNIFICANTLY_CHANGED,
    data: { team_id: '12345', document_id: 1 }
}

const mockSendFreehandUpdated = jest.fn()

describe('EventBusConsumer', () => {
    it('tells interested clients when a freehand has been updated', async () => {
        // @ts-ignore
        DocumentRevision.findAll = () => [
            { documentId: '12345' },
            { documentId: '67890' }
        ]
        SocketManager.getInstance().sendFreehandUpdated = mockSendFreehandUpdated

        await onFreehandSignificantlyChanged(
            mockFreehandSignificantlyChanged.data.document_id
        )

        expect(mockSendFreehandUpdated).toHaveBeenCalledWith(
            ['12345', '67890'],
            1
        )
    })
})
