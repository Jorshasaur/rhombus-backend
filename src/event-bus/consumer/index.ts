import { Consumer } from '@invisionapp/invision-node-eventbus'
import { Config } from '../../config'
import { Logger } from '../../util/Logger'
import { QueueTaskPusher } from '../../util/QueueManager'
import { Statsd } from '../../util/Statsd'
import {
    FreehandSignificantlyChanged,
    FREEHAND_SIGNIFICANTLY_CHANGED
} from './FreehandSignificantlyChanged'

interface State {
    pauseDuration: number
}

export class EventBusConsumer {
    static topics = [
        Config.eventBus.namespacePrefix + Config.eventBus.topicFreehandApiOut
    ]
    static consumerGroup = Config.eventBus.namespacePrefix + 'pages-api'
    static MAX_PAUSE_DURATION = 60000
    static PAUSE_INTERVAL = 10000

    state: State = {
        pauseDuration: 0
    }
    logger = Logger
    consumer = new Consumer(
        EventBusConsumer.topics,
        EventBusConsumer.consumerGroup,
        {
            fromOffset: 'latest'
        }
    )
    queueTaskPusher = QueueTaskPusher.getInstance()

    static start() {
        const consumer = new EventBusConsumer()
        consumer.consume()
        if (
            EventBusConsumer.topics.length === 0 ||
            !Config.eventBus.topicFreehandApiOut
        ) {
            consumer.handleTopicsMissing()
        }
        return consumer
    }

    private constructor() {}

    pause() {
        this.consumer._consumer.pause()
    }
    close() {
        this.consumer._consumer.close(false, (err) => {
            if (err) this.logger.error(err)
        })
    }
    paused() {
        return this.consumer._consumer.paused
    }
    resume() {
        this.consumer._consumer.resume()
    }

    handlePausedState() {
        setInterval(() => {
            if (!this.paused()) {
                this.state.pauseDuration = 0
                return
            }

            if (
                this.state.pauseDuration < EventBusConsumer.MAX_PAUSE_DURATION
            ) {
                this.state.pauseDuration += EventBusConsumer.PAUSE_INTERVAL
            } else {
                this.logger.info(
                    'EventBusConsumer: attempting to resume from paused state'
                )
                this.resume()
                this.state.pauseDuration = 0
            }
        }, EventBusConsumer.PAUSE_INTERVAL)
    }

    handleErrors() {
        this.consumer._consumer.on('error', (error) => {
            this.logger.error({ error }, 'Event bus consumer error')
            process.exit(1)
        })
    }

    handleTopicsMissing() {
        this.logger.error('No event bus topics. Closing.')
        this.close()
    }

    consume() {
        this.consumer.consume<FreehandSignificantlyChanged>(
            (_key, msg, ack) => {
                Statsd.increment('events.handle', 1, [`event-type:${msg.type}`])

                switch (msg.type) {
                    case FREEHAND_SIGNIFICANTLY_CHANGED: {
                        this.queueTaskPusher.emitFreehandUpdateToClient({
                            freehandDocumentId: msg.data.document_id
                        })
                        this.logger.info(
                            { messageType: msg.type },
                            'handling event bus message'
                        )
                        ack()
                        break
                    }
                    default:
                        this.logger.info(
                            { messageType: msg.type },
                            'received an unrecognized event bus message'
                        )
                        ack()
                        break
                }
            }
        )

        this.logger.info('Event Bus consumer successfully created.')
    }
}
