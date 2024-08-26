import SocketEmitter from './mock-socket-emitter'
import mockSocket from './mock-socket'

export default class mockIo {
    in: Function

    rooms: { [key: string]: mockSocket } = {}

    emitter = new SocketEmitter()

    on = jest.fn((event: string, listener: (...args: any[]) => void) => {
        this.emitter.on(event, listener)
    })

    emit = jest.fn((event: string, ...args: any[]) => {
        this.emitter.emit(event, ...args)
    })

    constructor() {
        this.in = this.to
    }

    adapter() {
        //
    }

    of(nsp: string) {
        return {
            adapter: new mockSocket(this, '1')
        }
    }

    to(room: string) {
        let roomSocket = this.rooms[room]
        if (!roomSocket) {
            roomSocket = new mockSocket(this, '1')
            this.rooms[room] = roomSocket
        }

        return roomSocket
    }
}
