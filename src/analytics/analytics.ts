import * as Analytics from 'analytics-node'

import { Config } from '../config'

import { UsersApiService } from '../services/UsersApiService'
import generateRequestTracing from '../util/GenerateRequestTracing'
import { Logger } from '../util/Logger'

const logger = Logger

let analytics: Analytics | null
if (Config.segmentApiKey != null) {
    analytics = new Analytics(Config.segmentApiKey!)
}

interface EventProperties {
    [key: string]: any
}

export default {
    COMMENT_SUBMITTED: 'App.Rhombus.Comment.Submitted',
    DOCUMENT_FOLLOWED: 'App.Rhombus.Doc.Followed',
    DOCUMENT_FOLLOWED_METHODS: {
        edit: 'FollowedbyEditing',
        comment: 'FollowedbyCommenting',
        manual: 'FollowedManually'
    },
    async track(
        event: string,
        userId: number,
        documentId: string,
        vendorId?: string,
        teamId?: string,
        properties: EventProperties = {}
    ) {
        let eventUserId = vendorId
        properties.documentId = documentId
        properties.internalUserId = userId

        if (!vendorId || !teamId) {
            const usersApiService = new UsersApiService()
            const user = await usersApiService.getUserProfile(
                userId,
                generateRequestTracing()
            )
            if (user) {
                eventUserId = user.vendorId
                properties.teamId = user.teamId
            } else {
                logger.error(
                    'Analytics#track - Unable to get user profile from users-api'
                )
            }
        }

        if (analytics != null && eventUserId) {
            analytics.track({
                userId: eventUserId,
                event,
                properties
            })
        } else {
            logger.info(
                `[TRACK] ${event}, userId: ${userId}, properties: ${JSON.stringify(
                    properties,
                    null,
                    4
                )}`
            )
        }
    }
}
