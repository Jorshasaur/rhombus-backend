import { Request } from 'express'
import * as urlModule from 'url'
import DomainService from './DomainService'
import { Prototype } from '../interfaces/prototypes/Prototype'
import { Share } from '../interfaces/prototypes/Share'
import { Screen } from '../interfaces/prototypes/Screen'
import { getOutgoingHeaders } from './utils'
import { Config } from '../config'
import { RequestTracing } from '../middleware/RequestTracing'
import { AxiosError } from 'axios'

interface PrototypeResponse {
    data: Prototype
}

interface ScreenResponse {
    data: Screen[]
}

interface ShareResponse {
    data: Share
}

export interface PrototypeResult {
    isMobile: boolean
    thumbnail?: string
    width: number
    height: number
    name: string
    updatedAt: string
}

function getHash(presentationSegment: string) {
    if (!presentationSegment) {
        return ''
    }

    return presentationSegment.substring(
        presentationSegment.lastIndexOf('-') + 1
    )
}

function createPrototypeResponse(
    prototype: Prototype,
    screen?: Screen
): PrototypeResult {
    const response = {
        isMobile: prototype.isMobile,
        thumbnail: prototype.homeScreenAssetURL,
        width: prototype.mobileDevice.viewportWidth,
        height: prototype.mobileDevice.viewportHeight,
        name: prototype.name,
        updatedAt: prototype.updatedAt
    }

    // If a screen is specified, return the largest thumbnail of that screen
    if (screen && screen.thumbnails.length) {
        const largestThumbnail = screen.thumbnails.reduce(
            (largest, screenThumbnail) => {
                if (screenThumbnail.width > largest.width) {
                    return screenThumbnail
                }
                return largest
            },
            screen.thumbnails[0]
        )
        response.thumbnail = largestThumbnail.assetURL
    }
    return response
}

export default class PrototypesApiService extends DomainService {
    constructor(req?: Request) {
        super(req)
        this.serviceName = 'prototypes-api'
    }

    public async getPrototypeByUrl(
        url: string,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ): Promise<PrototypeResult | undefined> {
        const parsedUrl = urlModule.parse(url)
        if (parsedUrl.pathname == null) {
            return
        }

        const pathnameParts = parsedUrl.pathname.substr(1).split('/')
        const urlType = pathnameParts[0]

        switch (urlType) {
            case 'console':
                return this.handleConsoleUrl(
                    getHash(pathnameParts[1]),
                    pathnameParts[2],
                    userId,
                    teamId,
                    requestTracing
                )
            case 'overview':
                return this.handleOverviewUrl(
                    getHash(pathnameParts[1]),
                    userId,
                    teamId,
                    requestTracing
                )
            case 'public':
                return this.handlePublicUrl(
                    pathnameParts[2],
                    userId,
                    teamId,
                    requestTracing
                )
            default:
                return
        }
    }

    private async handlePublicUrl(
        shareKey: string,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        if (!shareKey) {
            return
        }

        // Get the share by the Key
        const share = await this.getShareByKey(
            shareKey,
            userId,
            teamId,
            requestTracing
        )

        if (!share) {
            return
        }

        // Get the prototype
        const result = await this.getPrototypeById(
            share.data.prototypeID,
            userId,
            teamId,
            requestTracing
        )

        if (result == null) {
            return
        }

        return createPrototypeResponse(result.data)
    }

    private async handleOverviewUrl(
        hash: string,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        if (!hash) {
            return
        }

        const result = await this.getPrototypeByHash(
            hash,
            userId,
            teamId,
            requestTracing
        )

        if (result == null) {
            return
        }

        return createPrototypeResponse(result.data)
    }

    private async handleConsoleUrl(
        hash: string,
        screenHash: string,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        if (!hash) {
            return
        }

        if (screenHash != null) {
            const result = await this.getPrototypeByScreen(
                hash,
                screenHash,
                userId,
                teamId,
                requestTracing
            )

            if (result == null) {
                return
            }

            return createPrototypeResponse(result.prototype, result.screen)
        } else {
            const result = await this.getPrototypeByHash(
                hash,
                userId,
                teamId,
                requestTracing
            )

            if (result == null) {
                return
            }

            return createPrototypeResponse(result.data)
        }
    }

    private async getPrototypeByScreen(
        hash: string,
        screenHash: string,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        // First get the prototype
        const prototypeResult = await this.getPrototypeByHash(
            hash,
            userId,
            teamId,
            requestTracing
        )

        if (prototypeResult == null) {
            return
        }

        // Get the screens so we can grab the screen specified
        const screensResult = await this.getPrototypeScreens(
            prototypeResult.data.id,
            userId,
            teamId,
            requestTracing
        )

        if (screensResult == null) {
            return {
                prototype: prototypeResult.data
            }
        }

        // Find the screen by the hash
        const screen = screensResult.data.find((screenObject) => {
            return screenObject.hash === screenHash
        })

        return {
            prototype: prototypeResult.data,
            screen
        }
    }

    private async getPrototypeById(
        prototypeId: number,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        this.track('getPrototypeById')

        const options = {
            headers: getOutgoingHeaders(requestTracing),
            baseURL: Config.prototypesApi
        }

        try {
            const queryParams = `?userID=${userId}`
            const prototypeResponse = await this.axios.get<PrototypeResponse>(
                `/v1/teams/${teamId}/prototypes/${prototypeId}${queryParams}`,
                options
            )

            return prototypeResponse.data
        } catch (error) {
            return this.handleError(error)
        }
    }

    private async getPrototypeByHash(
        hash: string,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        this.track('getPrototypeByHash')

        const options = {
            headers: getOutgoingHeaders(requestTracing),
            baseURL: Config.prototypesApi
        }

        try {
            const queryParams = `?userID=${userId}`

            const prototypeResponse = await this.axios.get<PrototypeResponse>(
                `/v1/teams/${teamId}/prototypes/hash/${hash}${queryParams}`,
                options
            )

            return prototypeResponse.data
        } catch (error) {
            return this.handleError(error)
        }
    }

    private async getPrototypeScreens(
        prototypeId: number,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        this.track('getPrototypeScreens')

        const options = {
            headers: getOutgoingHeaders(requestTracing),
            baseURL: Config.prototypesApi
        }

        try {
            let queryParams = `?userID=${userId}`
            const prototypeResponse = await this.axios.get<ScreenResponse>(
                `/v1/teams/${teamId}/prototypes/${prototypeId}/screens${queryParams}`,
                options
            )

            return prototypeResponse.data
        } catch (error) {
            return this.handleError(error)
        }
    }

    private handleError(error: AxiosError) {
        if (error.response && error.response.status === 404) {
            return null
        }
        this.logError(error)
        return null
    }

    private async getShareByKey(
        shareKey: string,
        userId: number,
        teamId: string,
        requestTracing: RequestTracing
    ) {
        this.track('getShareByKey')

        const options = {
            headers: getOutgoingHeaders(requestTracing),
            baseURL: Config.prototypesApi
        }

        try {
            let queryParams = `?userID=${userId}`
            const shareResponse = await this.axios.get<ShareResponse>(
                `/v1/teams/${teamId}/shares/${shareKey}${queryParams}`,
                options
            )

            return shareResponse.data
        } catch (error) {
            return this.handleError(error)
        }
    }
}
