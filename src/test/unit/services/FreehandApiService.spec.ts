import FreehandApiService from '../../../services/FreehandApiService'
import * as sinon from 'sinon'

describe('FreehandApiService', () => {
    let sandbox = sinon.createSandbox()

    afterEach(() => {
        sandbox.restore()
    })

    describe('getUrls', () => {
        it('should get a freehand', (done) => {
            const requestTracking = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new FreehandApiService()

            const apiCall = sandbox.stub(apiService.axios, 'get').returns({
                then: () => {
                    return {
                        catch: () => {
                            return
                        }
                    }
                },
                catch: () => {}
            })

            apiService
                .getFreehand(
                    '1234',
                    requestTracking,
                    'freehand-private',
                    '0.0.0.0',
                    'Chrome'
                )
                .then((result: any) => {
                    expect(apiCall.called).toBe(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })
})
