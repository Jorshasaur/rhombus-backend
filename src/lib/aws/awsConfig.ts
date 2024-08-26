let AWS = require('aws-sdk')
import Bugsnag from '../../bugsnag'
import { Logger } from '../../util/Logger'
const logger = Logger

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION
})

AWS.events = new AWS.SequentialExecutor()

AWS.events.on('error', (error: Error) => {
    logger.fatal({ err: error }, 'AWS Event Error')
    Bugsnag.notify(error, { context: 'AWS Event Error', severity: 'error' })
})

export default AWS
