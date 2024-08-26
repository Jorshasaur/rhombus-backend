import { Producer, Message } from '@invisionapp/invision-node-eventbus'
import { Config } from '../../config'

export async function emit(type: string, eventData: any) {
    const producer = new Producer()
    const message = new Message(type, eventData)
    await producer.send(
        Config.eventBus.namespacePrefix + Config.eventBus.topic,
        message
    )
    return producer.close()
}
