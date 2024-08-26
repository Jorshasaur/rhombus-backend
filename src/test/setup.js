require('../../config/env')

import { QueueTaskPusher } from '../util/QueueManager'
import mockIo from './mocks/mock-socket-io'
jest.mock('@invisionapp/invision-node-eventbus')

jest.mock('../event-bus/producer', () => {
    return {
        emit: jest.fn(() => {
            return Promise.resolve()
        })
    }
})

const dummyQueueTask = jest.fn(() => {
    return true
})

class FakeQueueManager {
    saveSnapshot = dummyQueueTask
    sendMentionEmail = dummyQueueTask
    createNewThumbnail = dummyQueueTask
    updateLastViewed = dummyQueueTask
    startDocumentSession = dummyQueueTask
    emitEventBusEvent = dummyQueueTask
}

QueueTaskPusher.getInstance = jest.fn(() => {
    return new FakeQueueManager()
})

jest.mock('socket.io', () => {
    return () => {
        return new mockIo()
    }
})

jest.mock('../lib/socket.io-redis', () => {
    return () => {
        return {}
    }
})
