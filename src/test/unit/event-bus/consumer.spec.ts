import { Consumer } from '@invisionapp/invision-node-eventbus'
import { EventBusConsumer } from '../../../event-bus/consumer'
import { FREEHAND_SIGNIFICANTLY_CHANGED } from '../../../event-bus/consumer/FreehandSignificantlyChanged'
import { Statsd } from '../../../util/Statsd'

const QueueTaskPusher = jest.genMockFromModule<
    typeof import('../../../util/QueueManager')
>('../../../util/QueueManager').QueueTaskPusher
// @ts-ignore
QueueTaskPusher.getInstance = () => ({
    emitFreehandUpdateToClient: jest.fn()
})

const createConsumer = () => {
    const consumer = EventBusConsumer.start()
    // @ts-ignore
    consumer.logger = {
        info: jest.fn(),
        error: jest.fn()
    }
    consumer.consumer = new Consumer(
        EventBusConsumer.topics,
        EventBusConsumer.consumerGroup
    )
    consumer.consumer._consumer = {
        // @ts-ignore
        on: jest.fn().mockImplementation((str, cb) => cb('error, oh noes')),
        close: jest.fn()
    }
    consumer.queueTaskPusher = QueueTaskPusher.getInstance()
    consumer.handlePausedState()
    return consumer
}

describe('EventBusConsumer', () => {
    it('logs an error and closes the consumer when there are no topics', () => {
        const { topics } = EventBusConsumer
        EventBusConsumer.topics = []
        jest.spyOn(
            EventBusConsumer.prototype,
            'consume'
        ).mockImplementationOnce(() => {})
        jest.spyOn(
            EventBusConsumer.prototype,
            'close'
        ).mockImplementationOnce(() => {})

        const consumer = EventBusConsumer.start()

        expect(consumer.close).toHaveBeenCalled()

        EventBusConsumer.topics = topics
    })

    it('consumes freehand "significantly changed" events', () => {
        expect.assertions(3)
        const { handleErrors, handlePausedState } = EventBusConsumer.prototype
        EventBusConsumer.prototype.handleErrors = jest.fn()
        EventBusConsumer.prototype.handlePausedState = jest.fn()
        jest.spyOn(Statsd, 'increment').mockImplementationOnce(() => {})

        const ebConsumer = createConsumer()
        const msg = {
            type: FREEHAND_SIGNIFICANTLY_CHANGED,
            data: {
                document_id: 1
            }
        }
        const ack = jest.fn()
        ebConsumer.consumer.consume = jest
            .fn()
            .mockImplementation((cb) => cb(null, msg, ack))

        ebConsumer.consume()

        expect(
            ebConsumer.queueTaskPusher.emitFreehandUpdateToClient
        ).toHaveBeenCalledWith({
            freehandDocumentId: 1
        })
        expect(ack).toHaveBeenCalled()
        expect(Statsd.increment).toHaveBeenCalledWith('events.handle', 1, [
            `event-type:${FREEHAND_SIGNIFICANTLY_CHANGED}`
        ])

        EventBusConsumer.prototype.handleErrors = handleErrors
        EventBusConsumer.prototype.handlePausedState = handlePausedState
    })

    it('acknowledges unrecognized events and logs an error', () => {
        expect.assertions(2)
        const { handleErrors, handlePausedState } = EventBusConsumer.prototype
        EventBusConsumer.prototype.handleErrors = jest.fn()
        EventBusConsumer.prototype.handlePausedState = jest.fn()

        const ebConsumer = createConsumer()
        const msg = {
            type: 'some_random_message'
        }
        const ack = jest.fn()
        ebConsumer.consumer.consume = jest
            .fn()
            .mockImplementation((cb) => cb(null, msg, ack))

        ebConsumer.consume()

        expect(ebConsumer.logger.info).toHaveBeenCalledWith(
            { messageType: msg.type },
            expect.any(String)
        )
        expect(ack).toHaveBeenCalled()

        EventBusConsumer.prototype.handleErrors = handleErrors
        EventBusConsumer.prototype.handlePausedState = handlePausedState
    })

    it('attempts to resume itself when paused for 1 minute', () => {
        expect.assertions(7)
        jest.useFakeTimers()
        const {
            pause,
            paused,
            resume,
            handleErrors
        } = EventBusConsumer.prototype
        EventBusConsumer.prototype.pause = jest.fn()
        EventBusConsumer.prototype.paused = jest.fn(() => true)
        EventBusConsumer.prototype.resume = jest.fn()
        EventBusConsumer.prototype.handleErrors = jest.fn()

        const ebConsumer = createConsumer()
        expect(ebConsumer.paused).not.toHaveBeenCalled()
        expect(ebConsumer.resume).not.toHaveBeenCalled()
        expect(ebConsumer.state.pauseDuration).toBe(0)

        jest.runOnlyPendingTimers()
        expect(ebConsumer.state.pauseDuration).toBe(
            EventBusConsumer.PAUSE_INTERVAL
        )

        jest.runTimersToTime(EventBusConsumer.MAX_PAUSE_DURATION)
        expect(ebConsumer.logger.info).toHaveBeenCalled()
        expect(ebConsumer.resume).toHaveBeenCalled()
        expect(ebConsumer.state.pauseDuration).toBe(0)

        EventBusConsumer.prototype.pause = pause
        EventBusConsumer.prototype.paused = paused
        EventBusConsumer.prototype.resume = resume
        EventBusConsumer.prototype.handleErrors = handleErrors
    })

    it('exits the process on an error so that Forever will restart', () => {
        const {
            consume,
            handlePausedState,
            consumer
        } = EventBusConsumer.prototype
        EventBusConsumer.prototype.consume = jest.fn()
        EventBusConsumer.prototype.handlePausedState = jest.fn()
        EventBusConsumer.prototype.consumer = new Consumer(['foo'], 'foo')

        const ebConsumer = createConsumer()
        const exit = process.exit
        // @ts-ignore
        process.exit = jest.fn()
        ebConsumer.handleErrors()
        expect(ebConsumer.logger.error).toHaveBeenCalled()
        expect(process.exit).toHaveBeenCalledWith(1)

        process.exit = exit
        EventBusConsumer.prototype.consume = consume
        EventBusConsumer.prototype.handlePausedState = handlePausedState
        EventBusConsumer.prototype.consumer = consumer
    })
})
