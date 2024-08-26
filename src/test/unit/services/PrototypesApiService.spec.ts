import {
    RequestTrackingMock,
    DEFAULT_REQUEST_USER_ID,
    DEFAULT_REQUEST_TEAM_ID
} from '../../utils'
import PrototypesApiService from '../../../services/PrototypesApiService'
import { getOutgoingHeaders } from '../../../services/utils'
import { Config } from '../../../config'

function getPrototypeData() {
    return {
        data: {
            id: 1,
            isMobile: false,
            name: 'My Prototype',
            updatedAt: '2019-03-28T12:00:00Z',
            homeScreenAssetURL: 'http://image.jpg',
            mobileDevice: {
                viewportWidth: 0,
                viewportHeight: 0
            }
        }
    }
}

function getPrototypeResponse() {
    return {
        height: 0,
        isMobile: false,
        name: 'My Prototype',
        thumbnail: 'http://image.jpg',
        updatedAt: '2019-03-28T12:00:00Z',
        width: 0
    }
}

function getScreensData() {
    return {
        data: [
            {
                hash: 'nonotthisone'
            },
            {
                hash: 'anotherhash',
                thumbnails: [
                    {
                        width: 370,
                        assetURL: 'http://small-one.jpg'
                    },
                    {
                        width: 1080,
                        assetURL: 'http://big-one.jpg'
                    },
                    {
                        width: 960,
                        assetURL: 'http://medium-one.jpg'
                    }
                ]
            }
        ]
    }
}

function getShareData() {
    return {
        data: {
            prototypeID: 1
        }
    }
}

describe('PrototypesApiService', () => {
    it('should get prototype from overview url', async () => {
        const requestTracing = new RequestTrackingMock()
        const service = new PrototypesApiService()
        const url =
            'https://slate.invisionbeta.com/overview/Test-2-cju9sgpfi0cf501a6kwr7k81w/screens'

        service.axios.get = jest.fn((requestUrl: string) => {
            if (requestUrl.includes('/v1/teams/1/prototypes/hash')) {
                return Promise.resolve({ data: getPrototypeData() })
            }
            throw new Error('unknown endpoint')
        })

        const res = await service.getPrototypeByUrl(
            url,
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(service.axios.get).toHaveBeenCalledWith(
            '/v1/teams/1/prototypes/hash/cju9sgpfi0cf501a6kwr7k81w?userID=1',
            {
                baseURL: Config.prototypesApi,
                headers: getOutgoingHeaders(requestTracing)
            }
        )
        expect(res).toEqual(getPrototypeResponse())
    })

    it('should get prototype from console url', async () => {
        const requestTracing = new RequestTrackingMock()
        const service = new PrototypesApiService()
        const url =
            'https://slate.invisionbeta.com/console/Test-2-cju9sgpfi0cf501a6kwr7k81w'

        service.axios.get = jest.fn((requestUrl: string) => {
            if (requestUrl.includes('/v1/teams/1/prototypes/hash')) {
                return Promise.resolve({ data: getPrototypeData() })
            }
            throw new Error('unknown endpoint')
        })

        const res = await service.getPrototypeByUrl(
            url,
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(service.axios.get).toHaveBeenCalledWith(
            '/v1/teams/1/prototypes/hash/cju9sgpfi0cf501a6kwr7k81w?userID=1',
            {
                baseURL: Config.prototypesApi,
                headers: getOutgoingHeaders(requestTracing)
            }
        )
        expect(res).toEqual(getPrototypeResponse())
    })

    it('should get prototype from console url if screens returns 404', async () => {
        const requestTracing = new RequestTrackingMock()
        const service = new PrototypesApiService()
        const url =
            'https://slate.invisionbeta.com/console/Test-2-cju9sgpfi0cf501a6kwr7k81w/play'

        service.axios.get = jest.fn((requestUrl: string) => {
            if (requestUrl.includes('/v1/teams/1/prototypes/hash')) {
                return Promise.resolve({ data: getPrototypeData() })
            } else if (
                requestUrl.includes('/v1/teams/1/prototypes/1/screens')
            ) {
                return Promise.reject({ response: { status: 404 } })
            }
            throw new Error('unknown endpoint')
        })

        const res = await service.getPrototypeByUrl(
            url,
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(service.axios.get).toHaveBeenCalledWith(
            '/v1/teams/1/prototypes/hash/cju9sgpfi0cf501a6kwr7k81w?userID=1',
            {
                baseURL: Config.prototypesApi,
                headers: getOutgoingHeaders(requestTracing)
            }
        )
        expect(res).toEqual(getPrototypeResponse())
    })

    it('should get prototype from console url with screen', async () => {
        const requestTracing = new RequestTrackingMock()
        const service = new PrototypesApiService()
        const url =
            'https://slate.invisionbeta.com/console/Test-2-cju9sgpfi0cf501a6kwr7k81w/anotherhash/play'

        service.axios.get = jest.fn((requestUrl: string) => {
            if (requestUrl.includes('/v1/teams/1/prototypes/hash')) {
                return Promise.resolve({ data: getPrototypeData() })
            } else if (
                requestUrl.includes('/v1/teams/1/prototypes/1/screens')
            ) {
                return Promise.resolve({ data: getScreensData() })
            }
            throw new Error('unknown endpoint')
        })

        const res = await service.getPrototypeByUrl(
            url,
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(service.axios.get).toHaveBeenCalledWith(
            '/v1/teams/1/prototypes/hash/cju9sgpfi0cf501a6kwr7k81w?userID=1',
            {
                baseURL: Config.prototypesApi,
                headers: getOutgoingHeaders(requestTracing)
            }
        )

        expect(service.axios.get).toHaveBeenCalledWith(
            '/v1/teams/1/prototypes/1/screens?userID=1',
            {
                baseURL: Config.prototypesApi,
                headers: getOutgoingHeaders(requestTracing)
            }
        )

        const response = getPrototypeResponse()
        response.thumbnail = 'http://big-one.jpg'
        expect(res).toEqual(response)
    })

    it('should get prototype from public url', async () => {
        const requestTracing = new RequestTrackingMock()
        const service = new PrototypesApiService()
        const url = 'https://slate.invisionbeta.com/public/share/UVWTI7P7W'

        service.axios.get = jest.fn((requestUrl: string) => {
            if (requestUrl.includes('/v1/teams/1/shares')) {
                return Promise.resolve({ data: getShareData() })
            } else if (requestUrl.includes('/v1/teams/1/prototypes')) {
                return Promise.resolve({ data: getPrototypeData() })
            }
            throw new Error('unknown endpoint')
        })

        const res = await service.getPrototypeByUrl(
            url,
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(service.axios.get).toHaveBeenCalledWith(
            '/v1/teams/1/shares/UVWTI7P7W?userID=1',
            {
                baseURL: Config.prototypesApi,
                headers: getOutgoingHeaders(requestTracing)
            }
        )

        expect(service.axios.get).toHaveBeenCalledWith(
            '/v1/teams/1/prototypes/1?userID=1',
            {
                baseURL: Config.prototypesApi,
                headers: getOutgoingHeaders(requestTracing)
            }
        )

        expect(res).toEqual(getPrototypeResponse())
    })

    it('should handle invalid url', async () => {
        const requestTracing = new RequestTrackingMock()
        const service = new PrototypesApiService()

        let res = await service.getPrototypeByUrl(
            'https://slate.invisionbeta.com/public',
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(res).toBeUndefined()

        res = await service.getPrototypeByUrl(
            'https://slate.invisionbeta.com/console',
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(res).toBeUndefined()

        res = await service.getPrototypeByUrl(
            'https://slate.invisionbeta.com/overview',
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(res).toBeUndefined()

        res = await service.getPrototypeByUrl(
            'https://slate.invisionbeta.com/abc',
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(res).toBeUndefined()

        res = await service.getPrototypeByUrl(
            'https://slate.invisionbeta.com',
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestTracing
        )

        expect(res).toBeUndefined()
    })
})
