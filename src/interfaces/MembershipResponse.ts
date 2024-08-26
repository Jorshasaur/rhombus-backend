import { MembershipPermissions } from '@invisionapp/api-type-definitions/src/PagesApi'

export default interface MembershipResponse {
    userId: number
    permissions: MembershipPermissions
}
