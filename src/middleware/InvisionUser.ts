import * as joi from 'joi'
import { Request, Response, NextFunction } from 'express'
import { Logger } from '../util/Logger'
import { UsersApiService } from '../services/UsersApiService'
const isJson = require('is-json')

const logger = Logger

const EDGE_HEADER_SCHEMA = joi.object({
    user_id: joi
        .number()
        .integer()
        .min(1),
    company_id: joi.number().integer(),
    team_id: joi.string().min(1),
    session_id: joi.string().min(1),
    name: joi.string().min(1),
    email: joi.string().email()
})

export default async function InvisionUserMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (process.env.ENVIRONMENT === 'local') {
        req.headers['invision-edge-context'] =
            'eyJzZXNzaW9uX2lkIjoid3V4QU9LOThHclBzUGJvNzc1S2pZandMUmNiQ3g3Vkpsb2NhbCIsInVzZXJfaWQiOjEsInRlYW1faWQiOiJjamNqZW9pMncwMDAwcm4zNWMyM3E5OG91IiwiZW1haWwiOiJhZG1pbkBpbnZpc2lvbmFwcC5jb20ifQ=='
    }

    if (
        req.originalUrl === '/healthcheck' ||
        req.originalUrl.includes('/private/')
    ) {
        return next()
    }

    const [invisionUser, err] = parseEdgeContext(
        req.get('invision-edge-context')
    )

    if (err && req.originalUrl === '/rhombus-api/ws') {
        logger.info(
            { err: err, headers: req.headers },
            'Invalid invision-edge-context header'
        )
    }

    if (!invisionUser) {
        const user: any = {}
        if (req.query.team_id) {
            user.teamId = req.query.team_id
        } else if (
            req.invision &&
            req.invision.user &&
            req.invision.user.teamId
        ) {
            user.teamId = req.invision.user.teamId
        } else {
            return res.status(400).send({
                message:
                    'Team ID or team_id query param is required for this request'
            })
        }

        if (req.query.user_id) {
            user.userId = `${req.query.user_id}` // used to make a string from the number that represents the user id
            const usersApiService = new UsersApiService()
            const profile = await usersApiService.getUserProfile(
                user.userId,
                req.tracing
            )
            if (!profile) {
                throw new Error('Unable to get user from users-api')
            }
            user.email = profile.email
            user.name = profile.name
            user.vendorId = profile.vendorId
        }
        req.invision = Object.assign({}, req.invision || {}, { user })
    } else {
        req.invision = Object.assign({}, req.invision || {}, {
            user: {
                userId: `${invisionUser.user_id}`, // used to make a string from the number that represents the user id
                teamId: invisionUser.team_id,
                sessionId: invisionUser.session_id,
                name: invisionUser.name,
                email: invisionUser.email
            }
        })

        if (
            req.invision.user &&
            invisionUser.company_id !== -1 &&
            invisionUser.company_id !== 1
        ) {
            req.invision.user.companyId = invisionUser.company_id
        }
    }

    if (!req.invision.user.userId || !req.invision.user.teamId) {
        return res
            .status(400)
            .send({ message: 'Invalid userId or invalid teamId on request' })
    }

    next()
}

export function parseEdgeContext(headerValue?: string) {
    if (!headerValue) {
        return [null, null]
    }

    const edgeHeader = Buffer.from(headerValue, 'base64')
        .toString()
        .replace(/[\u0000-\u0019]+/g, '')

    if (!isJson(edgeHeader)) {
        return [null, 'Invalid SessionData header']
    }

    const schemaValidation = joi.validate(edgeHeader, EDGE_HEADER_SCHEMA)

    if (schemaValidation.error !== null) {
        return [null, 'Invalid Session object']
    }

    return [schemaValidation.value as any, null]
}
