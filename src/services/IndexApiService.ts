import { Config } from '../config'
import { RequestTracing } from '../middleware/RequestTracing'
import { getOutgoingHeaders } from './utils'
import DomainService from './DomainService'
import { Request } from 'express'
import { PermissionsResponse } from '@invisionapp/api-type-definitions/src/PagesApi'
import { ReducedRequest } from '../interfaces/ReducedRequest'
import { ErrorCollector } from '../util/ErrorCollector'

export interface GetPermissionsResponse {
    data: PermissionsResponse | null
    errors: string | null
}

export interface PermissionsParams {
    userId: number
    teamId: string
    actions: string
    spaceIds?: string
    documentType?: string
    documentIds?: string
}

export class IndexApiService extends DomainService {
    constructor(req?: Request | ReducedRequest) {
        super(req)
    }

    public async GetPermissionsForSpace(
        actions: string,
        userId: number,
        teamId: string,
        spaceId: string | undefined,
        requestTracing: RequestTracing
    ) {
        return this.GetPermissions(
            actions,
            undefined,
            userId,
            teamId,
            spaceId,
            requestTracing
        )
    }

    public async GetPermissionsForDocument(
        actions: string,
        documentIds: string | undefined,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        return this.GetPermissions(
            actions,
            documentIds,
            userId,
            teamId,
            '0',
            requestTracing
        )
    }

    private async GetPermissions(
        actions: string,
        documentIds: string | undefined,
        userId: number,
        teamId: string,
        spaceId: string | undefined,
        requestTracing: RequestTracing
    ): Promise<GetPermissionsResponse | null> {
        this.track('GetPermissions')
        try {
            let params: PermissionsParams = {
                userId,
                teamId,
                actions
            }
            if (documentIds) {
                params.documentIds = documentIds
                params.documentType = 'rhombus'
            } else {
                params.spaceIds = spaceId
            }
            const result = await this.axios.get('/v1/spaces/permissions', {
                baseURL: Config.indexApi,
                headers: getOutgoingHeaders(requestTracing),
                params: params
            })
            return result.data
        } catch (error) {
            this.logger.error('Error from GetPermissions call', error)
            ErrorCollector.notify(error, {
                getPermissionsData: {
                    userId,
                    teamId,
                    actions,
                    documentIds,
                    spaceIds: spaceId,
                    headers: getOutgoingHeaders(requestTracing)
                }
            })
            return null
        }
    }
}
