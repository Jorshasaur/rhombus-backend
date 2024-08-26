import { Config } from '../config'
import { AxiosError } from 'axios'
import * as _ from 'lodash'
import { RequestTracing } from '../middleware/RequestTracing'
import { getOutgoingHeaders } from './utils'
import { ThumbnailResponse } from '../interfaces/ThumbnailResponse'
import DomainService from './DomainService'
import { Request } from 'express'

export default class PresentationsApiService extends DomainService {
    constructor(req?: Request) {
        super(req)
        this.serviceName = 'presentations-api'
    }

    public async getPresentation(
        userId: number,
        teamId: string,
        presentationId: string,
        requestTracing: RequestTracing
    ): Promise<ThumbnailResponse | void> {
        this.track('getPresentation')
        const options = {
            headers: getOutgoingHeaders(requestTracing),
            baseURL: Config.presentationsApi
        }
        const presentation = await this.axios
            .get(
                `/v1/presentations/${presentationId}/metadata?userId=${userId}&teamId=${teamId}`,
                options
            )
            .catch((error: AxiosError) => {
                this.logError(error)
            })
        const thumbnailUrl = _.get(presentation, [
            'data',
            'identity',
            'thumbnailUrl'
        ])
        const name = _.get(presentation, ['data', 'identity', 'name'])
        const updatedAt = _.get(presentation, ['data', 'identity', 'updatedAt'])
        const width = _.get(presentation, ['data', 'presentation', 'width'])
        const height = _.get(presentation, ['data', 'presentation', 'height'])
        if (presentation) {
            return {
                name,
                thumbnailUrl,
                updatedAt,
                width,
                height
            }
        }
    }
}
