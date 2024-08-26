import Bugsnag from '../bugsnag'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { Config } from '../config'
import { LaunchDarklyHelper } from '../util/LaunchDarklyHelper'
import { Logger } from '../util/Logger'
const logger = Logger
const ldHelper = LaunchDarklyHelper.getInstance()

const LaunchDarkly: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void | Response> => {
    if (!Config.enableLD) {
        next()
        return
    }

    if (req.originalUrl.includes('/private/')) {
        next()
        return
    }

    const { email, teamId, userId } = req.invision.user

    if (email) {
        const hasAccess = !Config.enableLD
            ? true
            : await ldHelper.getFeatureFlagByUserAndTeamId(
                  LaunchDarklyHelper.HAS_ACCESS,
                  email,
                  teamId
              )
        if (hasAccess) {
            next()
            // Return here isn't strictly necessary but I had problems with TS without it
            return
        }
    }
    logger.debug(
        `Rejecting userId: ${userId}, teamId: ${teamId} because they are not enabled in the ${LaunchDarklyHelper.HAS_ACCESS} feature flag`
    )
    Bugsnag.notify('LD Rejected a User', {
        userInfo: {
            userId: userId,
            requestId: req.tracing.requestId,
            requestSource: req.tracing.requestSource,
            callingService: req.tracing.callingService
        }
    })
    // 401 might be better but this is causing a problem with the Edge trying to redirect to login
    return res.status(403).send({
        message: 'User does not have permission to access this resource'
    })
}

export default LaunchDarkly
