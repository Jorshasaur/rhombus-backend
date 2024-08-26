import { Config } from '../config'
import { AxiosError } from 'axios'
import { RequestTracing } from '../middleware/RequestTracing'
import { getOutgoingHeaders } from './utils'
import DomainService from './DomainService'
import { Request } from 'express'
import { AxiosInstance } from '@invisionapp/typed-api-defs/dist/axios'
import AssetsApi from '@invisionapp/api-type-definitions/src/AssetsApi'

export interface AssetResponse {
    url: string
    assetKey: string
    path: string
    content_type?: string
}

export default class AssetsApiService extends DomainService {
    axios: AxiosInstance<AssetsApi>

    constructor(req?: Request) {
        super(req)
        this.serviceName = 'assets-api'
    }

    public async getAssetFromAssetKey(
        assetKey: string,
        requestTracing: RequestTracing
    ): Promise<AssetResponse | void> {
        this.track('getAsset')
        const response = await this.axios
            .get<'/v1/protected/assets'>('/v1/protected/assets', {
                baseURL: Config.assetsApi,
                headers: getOutgoingHeaders(requestTracing),
                params: {
                    assetKey
                }
            })
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data
        }
    }

    public async getAssetFromUrl(
        assetUrl: string,
        requestTracing: RequestTracing
    ): Promise<AssetResponse | void> {
        this.track('getAsset')
        const response = await this.axios
            .get<'/v1/protected/assets'>('/v1/protected/assets', {
                baseURL: Config.assetsApi,
                headers: getOutgoingHeaders(requestTracing),
                params: {
                    assetUrl
                }
            })
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data
        }
    }

    public async createAssets(
        count: number,
        teamId: string,
        requestTracing: RequestTracing
    ): Promise<AssetResponse[] | void> {
        this.track('createAssets')
        const response = await this.axios
            .post<'/v1/protected/assets'>('/v1/protected/assets', undefined, {
                baseURL: Config.assetsApi,
                headers: getOutgoingHeaders(requestTracing),
                params: {
                    count,
                    team_id: teamId
                }
            })
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data.assets
        }
    }

    public async copyAsset(
        assetKey: string,
        requestTracing: RequestTracing
    ): Promise<AssetResponse | void> {
        this.track('copyAsset')
        const response = await this.axios
            .post<'/v1/protected/copy'>(
                '/v1/protected/copy',
                {},
                {
                    baseURL: Config.assetsApi,
                    headers: getOutgoingHeaders(requestTracing),
                    params: {
                        assetKey
                    }
                }
            )
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data
        }
    }

    public async getUrls(
        assetKeys: string[],
        requestTracing: RequestTracing,
        isPublic: boolean = false
    ): Promise<AssetResponse[] | void> {
        this.track('getUrls')
        const data = {
            assetKeys
        }

        const response = await this.axios
            .put<'/v1/protected/urls'>('/v1/protected/urls', data, {
                params: { public: isPublic },
                baseURL: Config.assetsApi,
                headers: getOutgoingHeaders(requestTracing)
            })
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data.assets
        }
    }

    public async getInfo(
        assetKeys: string[],
        requestTracing: RequestTracing
    ): Promise<AssetResponse[] | void> {
        this.track('getInfo')
        const data = {
            assetKeys
        }

        const response = await this.axios
            .post<'/v1/protected/assets/info'>(
                '/v1/protected/assets/info',
                data,
                {
                    baseURL: Config.assetsApi,
                    headers: getOutgoingHeaders(requestTracing)
                }
            )
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data.assets
        }
    }

    public async deleteAsset(assetKey: string, requestTracing: RequestTracing) {
        this.track('deleteAsset')
        await this.axios
            .delete<'/v1/protected/asset'>('/v1/protected/asset', {
                baseURL: Config.assetsApi,
                headers: getOutgoingHeaders(requestTracing),
                params: {
                    assetKey
                }
            })
            .catch((error: AxiosError) => {
                this.logError(error)
            })
    }
}
