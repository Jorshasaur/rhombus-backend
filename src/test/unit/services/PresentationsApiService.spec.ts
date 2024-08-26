import PresentationsApiService from '../../../services/PresentationsApiService'

describe('PresentationsApiService', () => {
    it('should get a presentation', async () => {
        const requestTracking = {
            requestId: '1',
            requestSource: 'test',
            outgoingCallingService: 'pages-api'
        }

        const apiService = new PresentationsApiService()
        apiService.axios.get = jest.fn(() => {
            return Promise.resolve({})
        })
        await apiService.getPresentation(123, '567', '890', requestTracking)
        expect(apiService.axios.get).toBeCalled()
    })
})
