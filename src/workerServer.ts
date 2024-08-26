import { Config, isLiveRhombusEnv } from './config'
if (isLiveRhombusEnv()) {
    require('newrelic')
}
import * as express from 'express'
import * as http from 'http'
import HealthcheckController from './controllers/HealthcheckController'
import ReadinessController from './controllers/ReadinessController'
import HandleErrors from './middleware/HandleErrors'
import { LaunchDarklyHelper } from './util/LaunchDarklyHelper'
import { Logger } from './util/Logger'

const Arena = require('bull-arena')

export class WorkerServer {
    public express: express.Application
    private server: http.Server
    private port: string | number
    private logger: Logger

    constructor() {
        this.logger = Logger
        this.createApp()
        this.config()
        this.createServer()
        this.addArena()
        this.routes()
        this.listen()
    }

    private createApp() {
        this.logger.debug('Initializing Express')
        this.express = express()
    }

    private createServer() {
        this.logger.debug('Initializing Worker Server')
        this.server = http.createServer(this.express)
    }

    private config() {
        this.logger.debug('Configuring Worker Application')
        this.port = Config.worker.port
    }

    private addArena() {
        const arena = Arena(
            {
                queues: [
                    {
                        name: Config.queueName,
                        hostId: 'Pages API Queue',
                        redis: {
                            host: Config.redis.host,
                            port: Config.redis.port
                        }
                    }
                ]
            },
            {
                disableListen: true,
                basePath: '/arena'
            }
        )
        this.express.use('/', arena)
    }

    private routes() {
        this.logger.debug('Registering Routes')
        this.express.use('/healthcheck', HealthcheckController)
        this.express.use('/readiness', ReadinessController)
        this.express.use(HandleErrors)
    }

    private listen() {
        this.logger.debug('Binding Worker Server to Port')
        this.server.listen(this.port, () => {
            this.logger.debug(`Worker Server Running on Port ${this.port}`)
            if (Config.enableLD) {
                this.logger.debug('Connecting to LaunchDarkly')
                LaunchDarklyHelper.getInstance().connect()
            }
        })
    }

    public gracefulShutdown() {
        this.logger.debug('Stopping the worker server gracefully')
        this.server.close()
    }
}
