import mockIo from './mock-socket-io'
import SocketEmitter from './mock-socket-emitter'

export default class mockSocket {
    handshake: any
    broadcast: mockIo

    emitter = new SocketEmitter()

    on = jest.fn((event: string, listener: (...args: any[]) => void) => {
        this.emitter.on(event, listener)
    })

    emit = jest.fn((event: string, ...args: any[]) => {
        this.emitter.emit(event, ...args)
    })

    join = jest.fn(() => {
        Promise.resolve()
    })

    disconnect = jest.fn()

    clients = jest.fn((callback: Function) => {
        const userIds = [1, 2, 3]
        callback(null, null, userIds)
    })

    constructor(io: mockIo, documentId: string, userId?: number) {
        this.handshake = {
            query: {
                documentId,
                userId
            },
            headers: {
                'invision-edge-context':
                    'eyJzZXNzaW9uX2lkIjoiV05ZTkdLenpWdUhzaXZ3OXFSc2ROS3JCOGtpNGh1bnJsb2NhbCIsInVzZXJfaWQiOjEsInRlYW1faWQiOiJjamNqZW9pMncwMDAwcm4zNWMyM3E5OG91IiwiZW1haWwiOiJhZG1pbkBpbnZpc2lvbmFwcC5jb20ifQ=='
            }
        }

        this.broadcast = io
    }
}
