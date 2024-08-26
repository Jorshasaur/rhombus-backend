declare module '@invisionapp/invision-node-eventbus' {
    export class Consumer {
        constructor(
            topics: string[],
            consumerGroup: string,
            options: {
                fromOffset?: 'earliest' | 'latest'
            }
        )
        _consumer: {
            on: (event: string, cb: (error: Error) => void) => void
            pause: () => void
            close: (force: boolean, cb: (error: Error) => void) => void
            paused: boolean
            resume: () => void
        }
        consume<T = { type: string }>(
            cb: (key: unknown, msg: T, ack: () => void) => void
        ): void
    }
    export class Producer {
        send(event: string, message: Message): Promise<void>
        close(): Promise<void>
    }
    export class Message {
        constructor(type: string, eventData: object)
    }
}
