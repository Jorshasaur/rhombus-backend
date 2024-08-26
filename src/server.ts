import { Config, isLiveRhombusEnv } from './config'
if (isLiveRhombusEnv()) {
    require('newrelic')
}

import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as http from 'http'
import { long as gitLong } from 'git-rev-sync'
import { wrap as asyncify } from 'async-middleware'

// Middleware
import InvisionUser from './middleware/InvisionUser'
import LaunchDarkly from './middleware/LaunchDarkly'
import { PermissionsMiddleware } from './middleware/Permissions'
import createRequestTracingMiddleware from './middleware/RequestTracing'
import HandleErrors from './middleware/HandleErrors'
import TeamIdParam from './middleware/TeamIdParam'
import Bugsnag from '@bugsnag/js'
import * as opentracing from 'opentracing'
const LightStep = require('lightstep-tracer')

// Top Level Controllers/Routes
import HealthcheckController from './controllers/HealthcheckController'
import DocumentController from './controllers/Document/Controller'
import TeamController from './controllers/Team/Controller'
import OperationController from './controllers/OperationController'
import PermissionsController from './controllers/Permissions/Controller'
import PrivateController from './controllers/Private/Controller'
import PaneController from './controllers/Pane/Controller'

import { Logger } from './util/Logger'
import { LaunchDarklyHelper } from './util/LaunchDarklyHelper'
import SocketManager from './util/SocketManager'
import SequelizeManager from './util/SequelizeManager'

export class Server {
    public static readonly PORT = 8080
    public express: express.Application
    private server: http.Server
    private port: string | number
    private logger: Logger

    constructor() {
        this.logger = Logger
        const bugsnagMiddleware = Bugsnag.getPlugin('express')!

        this.createApp()
        this.config()
        this.setupSequelize()
        this.createServer()
        // This must be the first piece of middleware in the stack.
        // It can only capture errors in downstream middleware
        this.logger.debug('Adding Bugsnag request handlers')
        this.express.use(bugsnagMiddleware.requestHandler)
        this.addBodyParser()
        this.middleware()
        this.addLightStep()
        this.routes()
        this.sockets()
        // This handles any errors that Express catches. Must go after all other middleware and routes
        this.logger.debug('Adding Bugsnag error handlers')
        this.express.use(bugsnagMiddleware.errorHandler)
        this.listen()
    }

    private createApp() {
        this.logger.debug('Initializing Express')
        this.express = express()
    }

    private createServer() {
        this.logger.debug('Initializing HTTP Server')
        this.server = http.createServer(this.express)
    }

    private config() {
        this.logger.debug('Configuring Application')
        this.port = process.env.PORT || Server.PORT
    }

    private setupSequelize() {
        this.logger.debug('Setting up Sequelize')
        SequelizeManager.getInstance().init()
    }

    private addBodyParser() {
        this.express.use(bodyParser.json({ limit: '3mb' }))
        this.express.use(
            bodyParser.urlencoded({ extended: false, limit: '3mb' })
        )
    }

    private middleware() {
        this.logger.debug('Registering Middleware')
        this.express.use(createRequestTracingMiddleware(gitLong()))
        this.express.all('/v1/teams/:teamId/*', TeamIdParam)
        this.express.use(asyncify(InvisionUser))
        this.express.use(asyncify(PermissionsMiddleware))
    }

    private addLightStep() {
        const lightstep = new LightStep.Tracer({
            access_token: Config.lightStep.token,
            component_name: 'pages-api'
        })
        if (Config.lightStep.host) {
            lightstep.collector_host = Config.lightStep.host
        }
        if (Config.lightStep.port) {
            lightstep.collector_port = Config.lightStep.port
        }
        if (Config.lightStep.protocol) {
            lightstep.collector_encryption =
                Config.lightStep.protocol === 'https' ? 'tls' : 'none'
        }
        opentracing.initGlobalTracer(lightstep)
    }

    private sockets() {
        if (Config.isEnabled) {
            this.logger.debug('Registering Sockets')
            SocketManager.getInstance().setServer(this.server)
        }
    }

    private routes() {
        this.logger.debug('Registering Routes')
        this.express.use('/healthcheck', HealthcheckController)
        if (Config.isEnabled) {
            this.express.use('/v1/documents', [
                asyncify(LaunchDarkly),
                DocumentController
            ])
            this.express.use('/v1/private', [
                asyncify(LaunchDarkly),
                PrivateController
            ])
            this.express.use('/v1/teams', [
                asyncify(LaunchDarkly),
                TeamController
            ])
            this.express.use('/v1/operations', [
                asyncify(LaunchDarkly),
                OperationController
            ])
            this.express.use('/v1/permissions', [
                asyncify(LaunchDarkly),
                PermissionsController
            ])
            this.express.use('/v1/panes', [
                asyncify(LaunchDarkly),
                PaneController
            ])
        }
        this.express.use(HandleErrors)
    }

    private listen() {
        this.logger.debug('Syncing Sequelize DB')
        SequelizeManager.getInstance()
            .sequelize.sync()
            .then(() => {
                this.logger.debug('Binding Server to Port')
                this.server.listen(this.port, () => {
                    this.logger.debug(`Server Running on Port ${this.port}`)
                    if (Config.enableLD) {
                        this.logger.debug('Connecting to LaunchDarkly')
                        LaunchDarklyHelper.getInstance().connect()
                    }
                })
            })
    }

    public gracefulShutdown() {
        this.logger.debug('Stopping the server gracefully')
        SocketManager.getInstance().close()
        SequelizeManager.getInstance().sequelize.close()
        this.server.close()
    }
}
