import { isLiveRhombusEnv } from '../config'
let newrelic: any
if (isLiveRhombusEnv()) {
    newrelic = require('newrelic')
}
import { wrap as asyncify } from 'async-middleware'
import { Request, Response, Router } from 'express'
import createMetrics from '../middleware/Metrics'

export class ReadinessController {
    router: Router

    constructor() {
        this.router = Router()
        this.init()
    }

    public async GetReadiness(req: Request, res: Response) {
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
            createMetrics('readiness'),
            asyncify(this.GetReadiness)
        )
    }
}

const readinessController = new ReadinessController()
readinessController.init()

export default readinessController.router
