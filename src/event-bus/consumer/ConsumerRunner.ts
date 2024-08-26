import { EventBusConsumer } from '.'

const consumer = EventBusConsumer.start()
consumer.handleErrors()
consumer.handlePausedState()
