import MembershipResponse from './MembershipResponse'

export default interface DocumentResponse {
    url: string
    id: string
    title: string
    ownerId: number
    teamId: string
    isArchived: boolean
    archivedAt?: Date
    createdAt: Date
    updatedAt: Date
    memberships: MembershipResponse[]
    thumbnailAssetKey?: string
}
