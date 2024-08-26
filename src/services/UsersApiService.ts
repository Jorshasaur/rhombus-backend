import { Config } from '../config'
import { AxiosError } from 'axios'
import * as _ from 'lodash'
import { RequestTracing } from '../middleware/RequestTracing'
import { getOutgoingHeaders } from './utils'
import { MembershipPermissions } from '../interfaces/MembershipPermissions'
import DomainService from './DomainService'
import { ReducedRequest } from '../interfaces/ReducedRequest'

export interface User {
    userId: number
    vendorId: string
    teamId: string
    name: string
    email: string
    avatarId: string
    avatarUrl: string
    isDefaultAvatar: boolean
    lastViewed?: Date
    permissions?: MembershipPermissions
}

interface Profile {
    userID: number
    teamID: string
    name: string
    email: string
    avatarID: string
    avatarURL: string
    isDefaultAvatar: boolean
}

interface UserResponse {
    id: number
    vendorID: string
    email: string
    profile: Profile
}

interface GetUserResponse {
    user: UserResponse
}

interface UserProfilesParams {
    userIds: number[]
    isInVisionAdmin?: boolean
    authUserID?: number
}

export class UsersApiService extends DomainService {
    constructor(req?: ReducedRequest) {
        super(req)
        this.serviceName = 'users-api'
    }

    public async getUserProfile(
        userId: number,
        requestTracing: RequestTracing
    ): Promise<User | void> {
        this.track('getUserProfile')
        const response = await this.axios
            .get<GetUserResponse>(`/v1/protected/users/${userId}`, {
                baseURL: Config.usersApi,
                headers: getOutgoingHeaders(requestTracing),
                params: {
                    authUserID: userId,
                    scope: 'profile'
                }
            })
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return this.transformUserResponse(response.data.user)
        }
    }

    /**
     * This method calls the users api and retrieves user profiles that the requester
     * has permission to view.
     *
     * Users-Api endpoint: /v1/protected/users
     * @param requestingId The id of the user making the request
     * @param userIds An array of user id's
     * @param requestTracing Request tracing data
     */
    public async getUserProfiles(
        requestingId: number,
        userIds: number[],
        requestTracing: RequestTracing
    ) {
        return this._getUserProfiles(
            { userIds, authUserID: requestingId },
            requestTracing
        )
    }

    public async getUserProfilesForAdmin(
        userIds: number[],
        requestTracing: RequestTracing
    ) {
        return this._getUserProfiles(
            { userIds, isInVisionAdmin: true },
            requestTracing
        )
    }

    private async _getUserProfiles(
        params: UserProfilesParams,
        requestTracing: RequestTracing
    ): Promise<User[]> {
        this.track('getUserProfiles')
        let users: User[] = []

        const requestParams: any = {
            ids: params.userIds.join(','),
            scope: 'profile'
        }

        if (params.authUserID != null) {
            requestParams.authUserID = params.authUserID
        }

        if (params.isInVisionAdmin != null) {
            requestParams.isInVisionAdmin = params.isInVisionAdmin
        }

        await this.axios
            .get('/v1/protected/users', {
                baseURL: Config.usersApi,
                headers: getOutgoingHeaders(requestTracing),
                params: requestParams
            })
            .then((response) => {
                if (response.data && response.data.users) {
                    users = this.mapUserData(response.data.users)
                }
            })
            .catch((error) => {
                this.logError(error)
            })

        return users
    }

    transformUserResponse(user: UserResponse): User {
        return {
            userId: user.profile.userID,
            vendorId: user.vendorID,
            teamId: user.profile.teamID,
            name: user.profile.name,
            email: user.profile.email,
            avatarId: user.profile.avatarID,
            avatarUrl: user.profile.avatarURL,
            isDefaultAvatar: user.profile.isDefaultAvatar
        }
    }

    /**
     * This function takes the response from the users api profile response call and maps it
     * into User objects.  It is marked public for testing.
     * @param users
     */
    public mapUserData(users: UserResponse[]): User[] {
        let parsedUsers: User[] = []
        parsedUsers = users.map((user) => {
            return this.transformUserResponse(user)
        })
        // Users should come back from the users-api in the same order we send them,
        // but I'm adding this just to be sure.
        parsedUsers = _.orderBy(parsedUsers, 'userId')
        return parsedUsers
    }
}
