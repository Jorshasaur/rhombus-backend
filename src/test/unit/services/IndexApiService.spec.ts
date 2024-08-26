import { IndexApiService } from '../../../services/IndexApiService'
import { Config } from '../../../config'

describe('IndexApiService', () => {
    it('should request permissions for space', async () => {
        const requestTracing = {
            requestId: '1',
            requestSource: 'test',
            outgoingCallingService: 'pages-api'
        }

        const indexApiService = new IndexApiService()
        indexApiService.axios.get = jest.fn(() => {
            return {
                data: []
            }
        })

        await indexApiService.GetPermissionsForSpace(
            'Document.Create',
            123,
            '1234',
            '33',
            requestTracing
        )
        expect(indexApiService.axios.get).toBeCalledWith(
            '/v1/spaces/permissions',
            {
                baseURL: Config.indexApi,
                headers: {
                    'Calling-Service': 'pages-api',
                    'Request-ID': '1',
                    'Request-Source': 'test'
                },
                params: {
                    actions: 'Document.Create',
                    spaceIds: '33',
                    teamId: '1234',
                    userId: 123
                }
            }
        )
    })

    it('should request permissions with documentType if documentId is provided', async () => {
        const requestTracing = {
            requestId: '1',
            requestSource: 'test',
            outgoingCallingService: 'pages-api'
        }

        const indexApiService = new IndexApiService()
        indexApiService.axios.get = jest.fn(() => {
            return {
                data: []
            }
        })

        await indexApiService.GetPermissionsForDocument(
            'Document.Create',
            '555',
            123,
            '1234',
            requestTracing
        )

        expect(indexApiService.axios.get).toBeCalledWith(
            '/v1/spaces/permissions',
            {
                baseURL: Config.indexApi,
                headers: {
                    'Calling-Service': 'pages-api',
                    'Request-ID': '1',
                    'Request-Source': 'test'
                },
                params: {
                    actions: 'Document.Create',
                    documentIds: '555',
                    documentType: 'rhombus',
                    teamId: '1234',
                    userId: 123
                }
            }
        )
    })
})
