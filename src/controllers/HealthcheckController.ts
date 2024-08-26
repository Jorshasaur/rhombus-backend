import { isLiveRhombusEnv } from '../config'
let newrelic: any
if (isLiveRhombusEnv()) {
    newrelic = require('newrelic')
}

import { Router, Request, Response } from 'express'
import { wrap as asyncify } from 'async-middleware'
import createMetrics from '../middleware/Metrics'

export class HealthcheckController {
    router: Router

    constructor() {
        this.router = Router()
        this.init()
    }

    public async GetHealthcheck(req: Request, res: Response) {
        if (newrelic) {
            newrelic.setIgnoreTransaction(true)
        }

        if (req.query.error) {
            throw new Error('oh noez!')
        }

        res.status(200).send({
            status: res.status,
            healthy: true
        })
    }

    init() {
        this.router.get(
            '/',
            createMetrics('healthcheck'),
            asyncify(this.GetHealthcheck)
        )
    }
}

const healthcheckController = new HealthcheckController()
healthcheckController.init()

export default healthcheckController.router
