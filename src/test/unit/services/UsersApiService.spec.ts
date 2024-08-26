import * as chai from 'chai'
import { UsersApiService, User } from '../../../services/UsersApiService'
import * as sinon from 'sinon'

describe('UsersApiService', () => {
    describe('getUserProfiles', () => {
        let sandbox = sinon.createSandbox()

        afterEach(() => {
            sandbox.restore()
        })

        it('should call the users api', (done) => {
            const usersApiService = new UsersApiService()
            const usersApiCall = sandbox
                .stub(usersApiService.axios, 'get')
                .returns({
                    then: () => {
                        return {
                            catch: () => {
                                return
                            }
                        }
                    }
                })

            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }
            1
            usersApiService
                .getUserProfiles(1, [1, 2, 3], requestTracing)
                .then((result) => {
                    chai.expect(usersApiCall.called).to.equal(true)
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })

    describe('mapUserData', () => {
        it('should return a valid user object', () => {
            const apiResponse = [
                {
                    id: 10,
                    vendorID: '1',
                    email: 'noone@nowhere.com',
                    profile: {
                        userID: 10,
                        teamID: '15',
                        name: 'Some Guy',
                        email: 'noone@nowhere.com',
                        avatarID: 'aabbcc',
                        avatarURL: 'http://google.com',
                        isDefaultAvatar: false
                    }
                }
            ]

            const usersApiService = new UsersApiService()
            const mapped: User[] = usersApiService.mapUserData(apiResponse)

            chai.expect(mapped.length).to.equal(1)
            chai.expect(mapped[0].userId).to.equal(
                apiResponse[0].profile.userID
            )
            chai.expect(mapped[0].vendorId).to.equal(apiResponse[0].vendorID)
            chai.expect(mapped[0].teamId).to.equal(
                apiResponse[0].profile.teamID
            )
            chai.expect(mapped[0].name).to.equal(apiResponse[0].profile.name)
            chai.expect(mapped[0].email).to.equal(apiResponse[0].profile.email)
            chai.expect(mapped[0].avatarId).to.equal(
                apiResponse[0].profile.avatarID
            )
            chai.expect(mapped[0].avatarUrl).to.equal(
                apiResponse[0].profile.avatarURL
            )
        })

        it('should order users by userId', () => {
            const apiResponse = [
                {
                    id: 10,
                    vendorID: '15',
                    email: 'noone@nowhere.com',
                    profile: {
                        userID: 10,
                        teamID: '15',
                        name: 'Third Guy',
                        email: 'noone@nowhere.com',
                        avatarID: 'aabbcc',
                        avatarURL: 'http://google.com',
                        isDefaultAvatar: false
                    }
                },
                {
                    id: 35,
                    vendorID: '16',
                    email: 'noone@nowhere.com',
                    profile: {
                        userID: 35,
                        teamID: '15',
                        name: 'Last Guy',
                        email: 'noone@nowhere.com',
                        avatarID: 'aabbcc',
                        avatarURL: 'http://google.com',
                        isDefaultAvatar: false
                    }
                },
                {
                    id: 1,
                    vendorID: '17',
                    email: 'noone@nowhere.com',
                    profile: {
                        userID: 1,
                        teamID: '15',
                        name: 'First Guy',
                        email: 'noone@nowhere.com',
                        avatarID: 'aabbcc',
                        avatarURL: 'http://google.com',
                        isDefaultAvatar: false
                    }
                },
                {
                    id: 7,
                    vendorID: '18',
                    email: 'noone@nowhere.com',
                    profile: {
                        userID: 7,
                        teamID: '15',
                        name: 'Second Guy',
                        email: 'noone@nowhere.com',
                        avatarID: 'aabbcc',
                        avatarURL: 'http://google.com',
                        isDefaultAvatar: false
                    }
                }
            ]

            const usersApiService = new UsersApiService()
            const mapped: User[] = usersApiService.mapUserData(apiResponse)

            chai.expect(mapped.length).to.equal(4)
            chai.expect(mapped[0].name).to.equal('First Guy')
            chai.expect(mapped[1].name).to.equal('Second Guy')
            chai.expect(mapped[2].name).to.equal('Third Guy')
            chai.expect(mapped[3].name).to.equal('Last Guy')
        })
    })

    describe('getUserProfile', () => {
        let sandbox = sinon.createSandbox()

        afterEach(() => {
            sandbox.restore()
        })

        it('should call the users api', (done) => {
            const user = {
                userID: 10,
                vendorID: '15',
                email: 'noone@nowhere.com',
                profile: {
                    userID: 10,
                    teamID: '15',
                    name: 'Some Guy',
                    email: 'noone@nowhere.com',
                    avatarID: 'aabbcc',
                    avatarURL: 'http://google.com',
                    isDefaultAvatar: true
                }
            }
            const usersApiService = new UsersApiService()
            const usersApiCall = sandbox
                .stub(usersApiService.axios, 'get')
                .resolves({ data: { user } })

            const requestTracing = {
                requestId: '1',
                requestSource: 'test',
                outgoingCallingService: 'pages-api'
            }

            usersApiService
                .getUserProfile(1, requestTracing)
                .then((result) => {
                    chai.expect(usersApiCall.called).to.equal(true)
                    chai.expect(result).to.deep.equals({
                        userId: user.profile.userID,
                        vendorId: user.vendorID,
                        teamId: user.profile.teamID,
                        name: user.profile.name,
                        email: user.profile.email,
                        avatarId: user.profile.avatarID,
                        avatarUrl: user.profile.avatarURL,
                        isDefaultAvatar: user.profile.isDefaultAvatar
                    })
                    done()
                })
                .catch((err) => {
                    done(err)
                })
        })
    })
})
