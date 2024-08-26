import AssetsApiService from '../../../services/AssetsApiService'
import * as sinon from 'sinon'

describe('AssetsApiService', () => {
    let sandbox = sinon.createSandbox()

    afterEach(() => {
        sandbox.restore()
    })

    describe('getUrls', () => {
        it('should call the assets api', (done) => {
            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new AssetsApiService()

            const apiCall = sandbox.stub(apiService.axios, 'put').returns({
                then: () => {
                    return {
                        catch: () => {
                            return
                        }
                    }
                },
                catch: () => {
                    return
                }
            })

            apiService
                .getUrls(['abc'], requestTracing)
                .then((result: any) => {
                    expect(apiCall.called).toBe(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('getInfo', () => {
        it('should call the assets api', (done) => {
            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new AssetsApiService()

            const apiCall = sandbox.stub(apiService.axios, 'post').returns({
                then: () => {
                    return {
                        catch: () => {
                            return
                        }
                    }
                },
                catch: () => {
                    return
                }
            })

            apiService
                .getInfo(['abc'], requestTracing)
                .then((result: any) => {
                    expect(apiCall.called).toBe(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('copyAsset', () => {
        it('should call the assets api', (done) => {
            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new AssetsApiService()

            const apiCall = sandbox.stub(apiService.axios, 'post').returns({
                catch: () => {
                    return
                }
            })

            apiService
                .copyAsset('abc', requestTracing)
                .then((result: any) => {
                    expect(apiCall.called).toBe(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('createAssets', () => {
        it('should call the assets api', (done) => {
            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new AssetsApiService()

            const apiCall = sandbox.stub(apiService.axios, 'post').returns({
                catch: () => {
                    return
                }
            })

            apiService
                .createAssets(1, '1', requestTracing)
                .then((result: any) => {
                    expect(apiCall.called).toBe(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('deleteAsset', () => {
        it('should call the assets api', (done) => {
            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new AssetsApiService()

            const apiCall = sandbox.stub(apiService.axios, 'delete').returns({
                catch: () => {
                    return
                }
            })

            apiService
                .deleteAsset('abc', requestTracing)
                .then((result: any) => {
                    expect(apiCall.called).toBe(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })
    describe('getAssetFromAssetKey', () => {
        it('should call the assets api', (done) => {
            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new AssetsApiService()

            const apiCall = sandbox.stub(apiService.axios, 'get').returns({
                catch: () => {}
            })

            apiService
                .getAssetFromAssetKey('abc', requestTracing)
                .then((result: any) => {
                    expect(apiCall.called).toBe(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })
    describe('getAssetFromUrl', () => {
        it('should call the assets api', (done) => {
            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            const apiService = new AssetsApiService()

            const apiCall = sandbox.stub(apiService.axios, 'get').returns({
                catch: () => {}
            })

            apiService
                .getAssetFromUrl('abc', requestTracing)
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
