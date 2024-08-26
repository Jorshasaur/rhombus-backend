import { DocumentMembership } from '../../../models/DocumentMembership'
import { getDocumentMembershipRecord } from '../controllers/utils'
import SocketManager from '../../../util/SocketManager'

describe('DocumentMembership', () => {
    beforeEach(() => {
        SocketManager.getInstance().sendSubscribedToDocument = jest.fn()
    })

    describe('autoSubscribe', () => {
        it('should auto subscribe user', async () => {
            const record = getDocumentMembershipRecord()
            record.isSubscribed = null
            record.save = jest.fn()

            DocumentMembership.findOne = jest.fn(() => {
                return record
            })
            await DocumentMembership.autoSubscribe('1', 1, 'edit')

            expect(record.save).toBeCalled()
            expect(
                SocketManager.getInstance().sendSubscribedToDocument
            ).toBeCalled()
        })

        it('should not auto subscribe user only if user was already subscribed or unsubscribed', async () => {
            const record = getDocumentMembershipRecord()
            record.isSubscribed = true
            record.save = jest.fn()

            DocumentMembership.findOne = jest.fn(() => {
                return record
            })
            await DocumentMembership.autoSubscribe('1', 1, 'edit')
            expect(record.save).not.toBeCalled()

            record.isSubscribed = false
            await DocumentMembership.autoSubscribe('1', 1, 'edit')
            expect(record.save).not.toBeCalled()
        })
    })
})
