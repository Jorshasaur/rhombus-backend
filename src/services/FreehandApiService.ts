import { Config } from '../config'
import { AxiosError } from 'axios'
import * as _ from 'lodash'
import { RequestTracing } from '../middleware/RequestTracing'
import { getOutgoingHeaders } from './utils'
import { ThumbnailResponse } from '../interfaces/ThumbnailResponse'
import DomainService from './DomainService'
import { Request } from 'express'

export default class FreehandApiService extends DomainService {
    constructor(req?: Request) {
        super(req)
        this.serviceName = 'freehand-api'
    }

    public async getFreehand(
        freehandSlug: string,
        requestTracing: RequestTracing,
        slugType: string,
        userIp?: string | string[],
        userAgent?: string | string[]
    ): Promise<ThumbnailResponse | void> {
        this.track('getFreehand')
        const options = {
            headers: {
                ...getOutgoingHeaders(requestTracing),
                'X-Request-IP-Address': userIp,
                'X-Request-User-Agent': userAgent
            },
            baseURL: Config.freehandApi
        }
        const slug = await this.axios
            .get(`/documents/slug/${slugType}/${freehandSlug}`, options)
            .catch((error: AxiosError) => {
                this.logError(error)
            })
        const thumbnailUrl = _.get(slug, ['data', 'document', 'thumbnail_url'])
        const name = _.get(slug, ['data', 'document', 'name'])
        const updatedAt = _.get(slug, ['data', 'document', 'updated_at'])
        if (thumbnailUrl) {
            return {
                name,
                thumbnailUrl,
                updatedAt
            }
        }
    }
}
