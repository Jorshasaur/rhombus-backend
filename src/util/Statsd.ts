import { Config } from '../config'
import { Logger } from './Logger'
import { StatsD } from 'node-statsd'

const logger = Logger

const Statsd = new StatsD({
    host: Config.statsd.host,
    port: Config.statsd.port,
    prefix: Config.statsd.prefix
})

Statsd.socket.on('error', (err) => {
    return logger.debug({ err }, 'Error in StatsD socket')
})

export { Statsd }
