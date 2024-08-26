import {
    DocumentResponse,
    DocumentRevision as DocumentRevisionType
} from '@invisionapp/api-type-definitions/src/PagesApi'
import { Router as TypedRouter } from '@invisionapp/typed-api-defs/dist/express'
import { wrap as asyncify } from 'async-middleware'
import { Request, Response, Router } from 'express'
import * as validate from 'express-validation'
import * as _ from 'lodash'
import * as moment from 'moment'
import { Transaction } from 'sequelize'
import { IFindOptions, IIncludeOptions } from 'sequelize-typescript'
import analytics from '../../analytics/analytics'
import { Config } from '../../config'
import { PERMISSION_TYPES } from '../../constants/AccessSettings'
import * as eventBusProducer from '../../event-bus/producer/events'
import { MembershipPermissions } from '../../interfaces/MembershipPermissions'
import MembershipResponse from '../../interfaces/MembershipResponse'
import createMetrics from '../../middleware/Metrics'
import { Document } from '../../models/Document'
import { DocumentMembership } from '../../models/DocumentMembership'
import { DocumentRevision } from '../../models/DocumentRevision'
import AssetsApiService from '../../services/AssetsApiService'
import PermissionsService from '../../services/permissions/Service'
import { User, UsersApiService } from '../../services/UsersApiService'
import deltaToText from '../../util/DeltaToText'
import { LaunchDarklyHelper } from '../../util/LaunchDarklyHelper'
import { Logger } from '../../util/Logger'
import {
    getMembershipPermissions,
    getMembershipPermissionsForDocuments
} from '../../util/MembershipPermissions'
import { QuillDeltaConverter } from '../../util/QuillDeltaConverter'
import SequelizeManager from '../../util/SequelizeManager'
import SocketManager from '../../util/SocketManager'
import AssetController from '../Asset/Controller'
import {
    EmitGenericEventRequest,
    EmitGenericEventResponse,
    GetDocumentAsGuestRequest,
    GetDocumentAsGuestResponse
} from '../Private/Api'
import { transformDocument } from '../utils'
import {
    AddMembersToMembershipsRequest,
    AddMembersToMembershipsResponse,
    ArchiveDocumentRequest,
    ArchiveDocumentResponse,
    DocumentsAPI,
    GetAccessSettingsRequest,
    GetAccessSettingsResponse,
    GetDocumentRequest,
    GetDocumentResponse,
    GetDocumentRevisionRequest,
    GetDocumentRevisionResponse,
    GetDocumentRevisionsRequest,
    GetDocumentRevisionsResponse,
    GetDocumentTextRequest,
    GetDocumentTextResponse,
    GetDocumentThumbnailRequest,
    GetDocumentThumbnailResponse,
    GetMembershipsRequest,
    GetMembershipsResponse,
    GetPermissionsForDocumentsRequest,
    GetPermissionsForDocumentsResponse,
    GetPermissionsRequest,
    GetPermissionsResponse,
    ListDocumentsRequest,
    ListDocumentsResponse,
    NewDocumentRequest,
    NewDocumentResponse,
    RemoveFromMembershipsRequest,
    RemoveFromMembershipsResponse,
    SetAccessSettingsRequest,
    SetAccessSettingsResponse,
    SubscribeToDocumentRequest,
    SubscribeToDocumentResponse,
    UnarchiveDocumentRequest,
    UnarchiveDocumentResponse,
    UnsubscribeFromDocumentRequest,
    UnsubscribeFromDocumentResponse,
    UpdateMembershipsRequest,
    UpdateMembershipsResponse
} from './Api'
import {
    addToMembershipsValidation,
    archiveDocumentValidation,
    createDocumentValidation,
    getDocumentAtRevisionValidation,
    getDocumentHtmlValidation,
    getDocumentRevisionsValidation,
    getDocumentTextValidation,
    getDocumentThumbnailValidation,
    getDocumentValidation,
    getPermissionsForDocumentsValidation,
    removeFromMembershipsValidation,
    setAccessSettingsValidation,
    subscribeToDocumentValidation,
    unarchiveDocumentValidation,
    unsubscribeFromDocumentValidation,
    updateMembershipsValidation
} from './Validations'

interface MemberToAdd {
    userId: number
    permissions: MembershipPermissions
}

interface RevisionMetric {
    amount: number
    metric: 'minutes' | 'hours' | 'days'
}

export const DEFAULT_REVISION_METRICS = {
    greater: {
        amount: 3,
        metric: 'days' as 'days'
    },
    pastDay: {
        amount: 60,
        metric: 'minutes' as 'minutes'
    },
    pastMonth: {
        amount: 12,
        metric: 'hours' as 'hours'
    },
    pastWeek: {
        amount: 2,
        metric: 'hours' as 'hours'
    }
}
export class DocumentController {
    router: TypedRouter<DocumentsAPI>
    logger: Logger
    usersApiService: UsersApiService

    constructor() {
        this.router = Router()
        this.init()
        this.logger = Logger
        this.usersApiService = new UsersApiService()
    }

    public ListDocuments = async (
        req: ListDocumentsRequest,
        res: ListDocumentsResponse
    ) => {
        const documents = await Document.findAll<Document>()
        res.status(200).json({
            documents
        })
    }

    public CreateDocument = async (
        req: NewDocumentRequest,
        res: NewDocumentResponse
    ) => {
        await req.permissions.canCreateDocument(req.body.spaceId)

        let document: Document
        await SequelizeManager.getInstance().sequelize.transaction(
            async (t: Transaction) => {
                document = await Document.create<Document>(
                    {
                        title: req.body.title,
                        ownerId: req.invision.user.userId,
                        teamId: req.invision.user.teamId
                    },
                    { transaction: t }
                )

                await DocumentMembership.findOrCreate({
                    where: {
                        userId: req.invision.user.userId,
                        documentId: document.id,
                        permissions: PERMISSION_TYPES.EDIT
                    },
                    transaction: t
                })
            }
        )

        const documentResponse = await this.getDocumentResponse(
            document!,
            req.query.includeContents!
        )
        res.json(documentResponse)
    }

    public GetDocumentAsGuest = async (
        req: GetDocumentAsGuestRequest,
        res: GetDocumentAsGuestResponse
    ) => {
        const getDocumentQuery: IFindOptions<Document> = {}
        const document = await Document.findDocumentAsGuest(
            req.params.documentId,
            getDocumentQuery
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        const documentResponse = await this.getDocumentAsGuestResponse(document)

        res.json(documentResponse)
    }

    public GetDocument = async (
        req: GetDocumentRequest,
        res: GetDocumentResponse
    ) => {
        const getDocumentQuery: IFindOptions<Document> = {}

        if (req.query.includeMemberships) {
            let includedMembershipsAttributes = ['userId']

            if (req.query.includeSubscriptions) {
                includedMembershipsAttributes.push('isSubscribed')
            }

            const includeMembership: IIncludeOptions = {
                model: DocumentMembership,
                attributes: includedMembershipsAttributes
            }

            getDocumentQuery.include = [includeMembership]
        }

        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId,
            getDocumentQuery
        )
        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        let userMembership = await PermissionsService.hasDocumentMembership({
            userId: req.invision.user.userId,
            documentId: document.id
        })

        if (!userMembership) {
            try {
                await req.permissions.canJoinAndViewDocument(document)
            } catch (e) {
                res.status(403).send({
                    message: 'User does not have permissions for this document.'
                })
                return
            }

            await SequelizeManager.getInstance().sequelize.transaction(
                async (t: Transaction) => {
                    const [
                        newMembership
                    ] = await DocumentMembership.findOrCreate({
                        where: {
                            userId: req.invision.user.userId,
                            documentId: document.id
                        },
                        defaults: {
                            permissions: document.permissions
                        },
                        transaction: t
                    })

                    if (!newMembership) {
                        this.logger.error(
                            'Unable to find or create a user membership'
                        )
                        throw new Error(
                            'Unable to get document because we cant create membership'
                        )
                    }

                    userMembership = newMembership
                }
            )
        }

        const documentResponse = await this.getDocumentResponse(
            document,
            req.query.includeContents!,
            userMembership!
        )

        if (!documentResponse) {
            throw new Error('Unable to create membership')
        }

        res.json(documentResponse)
    }

    private _createRevisionSession = (
        revisionTime: moment.Moment,
        previousRevisionTime: moment.Moment,
        revisionResponse: DocumentRevisionType[],
        currentRevision: DocumentRevision,
        amount: number,
        metric: 'minutes' | 'hours' | 'days'
    ) => {
        if (
            revisionTime.isBetween(
                previousRevisionTime,
                moment(previousRevisionTime).add(amount, metric),
                'seconds',
                '[]'
            )
        ) {
            const usersSet = new Set(
                revisionResponse[revisionResponse.length - 1].users
            ).add(currentRevision.userId)
            return [
                ...revisionResponse.slice(0, revisionResponse.length - 1),
                {
                    revision: currentRevision.revision,
                    id: currentRevision.id,
                    users: Array.from(usersSet),
                    createdAt: currentRevision.createdAt,
                    revert: currentRevision.revert
                }
            ]
        } else {
            return [
                ...revisionResponse,
                {
                    revision: currentRevision.revision,
                    id: currentRevision.id,
                    users: [currentRevision.userId],
                    createdAt: currentRevision.createdAt,
                    revert: currentRevision.revert
                }
            ]
        }
    }

    public GetDocumentRevisions = async (
        req: GetDocumentRevisionsRequest,
        res: GetDocumentRevisionsResponse
    ) => {
        const getDocumentQuery: IFindOptions<Document> = {}

        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId,
            getDocumentQuery
        )
        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        // check permissions
        await req.permissions.canJoinAndViewDocument(document)

        const revisions = await DocumentRevision.findAll({
            attributes: ['revision', 'id', 'userId', 'createdAt', 'revert'],
            where: { documentId: req.params.documentId },
            order: [['revision', 'ASC']]
        })

        const todayMoment = moment()
        const yesterday = moment(todayMoment).subtract(1, 'days')
        const lastWeek = moment(todayMoment).subtract(7, 'days')
        const lastMonth = moment(todayMoment).subtract(1, 'months')

        const ldHelper = LaunchDarklyHelper.getInstance()
        let metrics: {
            pastDay: RevisionMetric
            pastWeek: RevisionMetric
            pastMonth: RevisionMetric
            greater: RevisionMetric
        } = DEFAULT_REVISION_METRICS
        try {
            metrics = await ldHelper.getFeatureFlagByUserAndTeamId(
                LaunchDarklyHelper.DOCUMENT_HISTORY_COMBINATION_METRICS,
                req.invision.user.email,
                req.invision.user.teamId,
                DEFAULT_REVISION_METRICS
            )
        } catch (error) {
            this.logger.error(
                { error },
                `Error getting feature flag: ${LaunchDarklyHelper.DOCUMENT_HISTORY_COMBINATION_METRICS}`
            )
        }

        const revisionResponse = revisions.reduce(
            (
                previousValue: DocumentRevisionType[],
                currentValue: DocumentRevision
            ): DocumentRevisionType[] => {
                const revisionTime = moment(currentValue.createdAt)

                if (
                    !previousValue.length ||
                    previousValue[previousValue.length - 1].revert ||
                    currentValue.revert
                ) {
                    return [
                        ...previousValue,
                        {
                            revision: currentValue.revision,
                            id: currentValue.id,
                            users: [currentValue.userId],
                            createdAt: currentValue.createdAt,
                            revert: currentValue.revert
                        }
                    ]
                }
                const previousRevisionTime = moment(
                    previousValue[previousValue.length - 1].createdAt
                )
                // If within the last day
                if (
                    revisionTime.isBetween(
                        yesterday,
                        todayMoment,
                        'seconds',
                        '(]'
                    )
                ) {
                    return this._createRevisionSession(
                        revisionTime,
                        previousRevisionTime,
                        previousValue,
                        currentValue,
                        metrics.pastDay.amount,
                        metrics.pastDay.metric
                    )
                } else if (
                    revisionTime.isBetween(lastWeek, yesterday, 'seconds', '(]')
                ) {
                    return this._createRevisionSession(
                        revisionTime,
                        previousRevisionTime,
                        previousValue,
                        currentValue,
                        metrics.pastWeek.amount,
                        metrics.pastWeek.metric
                    )
                } else if (
                    revisionTime.isBetween(lastMonth, lastWeek, 'seconds', '(]')
                ) {
                    return this._createRevisionSession(
                        revisionTime,
                        previousRevisionTime,
                        previousValue,
                        currentValue,
                        metrics.pastMonth.amount,
                        metrics.pastMonth.metric
                    )
                } else {
                    return this._createRevisionSession(
                        revisionTime,
                        previousRevisionTime,
                        previousValue,
                        currentValue,
                        metrics.greater.amount,
                        metrics.greater.metric
                    )
                }
            },
            []
        )
        res.json(revisionResponse)
    }

    public GetDocumentAtRevision = async (
        req: GetDocumentRevisionRequest,
        res: GetDocumentRevisionResponse
    ) => {
        const getDocumentQuery: IFindOptions<Document> = {}

        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId,
            getDocumentQuery
        )
        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        // check permissions
        await req.permissions.canJoinAndViewDocument(document)

        const contents = await document.contents(undefined, req.params.revision)
        const documentResponse = {
            success: true,
            contents
        }

        if (!documentResponse) {
            throw new Error('Unable to create membership')
        }

        res.json(documentResponse)
    }

    public async getDocumentResponse(
        document: Document,
        includeContents: boolean,
        membership?: DocumentMembership
    ) {
        const documentData: DocumentResponse = {
            success: true,
            document: transformDocument(document)
        }

        if (membership != null) {
            documentData.permissions = membership.permissionsObject()
            documentData.isSubscribed = membership.isSubscribed === true
        }

        if (includeContents) {
            documentData.contents = await document.contents()
        }

        return documentData
    }

    public async getDocumentAsGuestResponse(document: Document) {
        const documentData = {
            success: true,
            document: transformDocument(document)
        }

        return documentData
    }

    public GetDocumentHtml = async (req: Request, res: Response) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        const ops = (await document.contents()).delta.ops

        const freehandOptions = {
            ip: req.ip,
            userAgent: req.headers['user-agent'] as string,
            hostname: req.headers['x-forwarded-host'] as string
        }

        const converter = new QuillDeltaConverter(
            req.invision.user,
            freehandOptions,
            req.tracing
        )
        const html = await converter.convert(document, ops!, {})

        res.send(html)
    }

    public GetDocumentText = async (
        req: GetDocumentTextRequest,
        res: GetDocumentTextResponse
    ) => {
        // get document
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        // check permissions
        await req.permissions.canJoinAndViewDocument(document)

        // get document text
        const contents = await document.contents()

        res.status(200).json({
            text: deltaToText(contents.delta)
        })
    }

    public ArchiveDocument = async (
        req: ArchiveDocumentRequest,
        res: ArchiveDocumentResponse
    ) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )
        if (!document) {
            return res.status(404).send({ message: 'Document not found' })
        }

        await req.permissions.canArchiveDocument(document)
        document.isArchived = true
        document.archivedAt = new Date()
        await document.save()

        SocketManager.getInstance().sendDocumentArchivedEvent(document.id)

        eventBusProducer.documentArchived(req.invision.user.teamId, document.id)

        return res.status(200).json({
            success: true
        })
    }

    public UnarchiveDocument = async (
        req: UnarchiveDocumentRequest,
        res: UnarchiveDocumentResponse
    ) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )
        if (!document) {
            return res.status(404).send({ message: 'Document not found' })
        }

        await req.permissions.canArchiveDocument(document)
        document.isArchived = false
        document.archivedAt = null
        await document.save()

        SocketManager.getInstance().sendDocumentUnArchivedEvent(document.id)

        eventBusProducer.documentRestored(req.invision.user.teamId, document.id)

        return res.status(200).json({
            success: true
        })
    }

    public GetRevisionsSinceRevision = async (req: Request, res: Response) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (!document) {
            return res.status(404).send({ message: 'Document not found' })
        }

        const previousRevisions = (
            await document.getRevisionsAfterRevision(req.params.revisionNum)
        ).map((revision) => {
            return {
                operation: revision.delta,
                revision: revision.revision,
                userId: revision.userId,
                submissionId: revision.submissionId,
                createdAt: revision.createdAt.getTime()
            }
        })

        return res.status(200).json({
            success: true,
            revisions: previousRevisions
        })
    }

    public GetMemberships = async (
        req: GetMembershipsRequest,
        res: GetMembershipsResponse
    ) => {
        const userId =
            req.invision && req.invision.user
                ? req.invision.user.userId
                : undefined

        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        // If there is no document here then you can't be a member bro
        // If we can't retrieve the user id then their session is in a bad state
        if (!document || !userId) {
            this.logger.error(
                'GetMemberships Error:: Document or user id is invalid'
            )
            return res.status(404)
        }

        let members = await document.members()
        const memberIds = members.map((member) => {
            return member.userId
        })

        const usersApiService = new UsersApiService()
        // The UsersApiService needs the user id's we want requested from the context of the user for
        // permission checks
        const profiles = await usersApiService.getUserProfilesForAdmin(
            memberIds,
            req.tracing
        )

        if (!members || !profiles || members.length !== profiles.length) {
            // TODO: Talk about account deletion or permission changes
            this.logger.error(
                "GetMemberships Error:: Number of members doesn't match number of profiles"
            )
            return res.status(500)
        }

        // Since we have the same list of members and profiles, we merge them together by just
        // grabbing the lastViewed from the members.  Profiles has the rest of what we want.
        // And because members and profiles are ordered by userId and should be the same length,
        // we can use a merge safely.
        const groupedMembers = profiles.map((profile: User, index: number) => {
            const member = members[index]
            // TODO: Make lastViewed -1 or something if it was never viewed
            profile.lastViewed = member.lastViewed
                ? member.lastViewed
                : new Date()
            profile.permissions = member.permissionsObject()
            return profile
        })

        // The sorting rules here are:
        // 1. The requesting user is always first
        // 2. We sort on the most recently viewed otherwise
        // 3. If the recently viewed times are the same then it should use the default (userId)
        let sortedGroupedMembers = _.orderBy(
            groupedMembers,
            (member: User) => {
                if (member.userId === +userId) {
                    // Returning undefined should always put the user on the top
                    return undefined
                } else {
                    return member.lastViewed
                }
            },
            'desc'
        )

        return res.status(200).json({
            success: true,
            members: sortedGroupedMembers
        })
    }

    public AddMembersToMemberships = async (
        req: AddMembersToMembershipsRequest,
        res: AddMembersToMembershipsResponse
    ) => {
        const { documentId } = req.params
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        await req.permissions.canAddMembersToDocument(document)

        const membersToAdd: MemberToAdd[] = req.body.members

        const memberToAddPromises = membersToAdd.map(async (memberToAdd) => {
            const user = await this.usersApiService.getUserProfile(
                memberToAdd.userId,
                req.tracing
            )
            if (user == null) {
                throw new Error(
                    'AddToMemberships - Unable to get user profile from users-api'
                )
            }

            if (Config.enableLD) {
                const hasAccess = await LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId(
                    LaunchDarklyHelper.HAS_ACCESS,
                    user.email,
                    req.invision.user.teamId
                )
                if (!hasAccess) {
                    this.logger.debug(
                        `AddToMemberships - Rejecting user because they are not enabled in the ${LaunchDarklyHelper.HAS_ACCESS} feature flag`
                    )
                    return
                }
            }

            const permissions =
                memberToAdd.permissions && memberToAdd.permissions.canEdit
                    ? PERMISSION_TYPES.EDIT
                    : PERMISSION_TYPES.COMMENT

            return DocumentMembership.findCreateFind({
                where: {
                    userId: memberToAdd.userId,
                    documentId: documentId
                },
                defaults: {
                    permissions
                }
            })
        })

        const addedMembers = await Promise.all(memberToAddPromises)
        const members = addedMembers.reduce(
            (membersRes: MembershipResponse[], addedMemberRes) => {
                if (addedMemberRes != null) {
                    const [addedMember, added] = addedMemberRes
                    membersRes.push({
                        userId: addedMember.userId,
                        permissions: addedMember.permissionsObject()
                    })
                    if (added) {
                        eventBusProducer.documentParticipantAdded(
                            req.invision.user.teamId,
                            document.id,
                            addedMember.userId
                        )
                    }
                }

                return membersRes
            },
            []
        )

        return res.json({ members })
    }

    public UpdateMemberships = async (
        req: UpdateMembershipsRequest,
        res: UpdateMembershipsResponse
    ) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        await req.permissions.canAddMembersToDocument(document)

        const userMembership = await PermissionsService.hasDocumentMembership({
            userId: req.params.memberId,
            documentId: req.params.documentId
        })

        if (userMembership == null) {
            res.status(404).send({
                message: 'Given user is not member of this document'
            })
            return
        }

        userMembership.permissions = req.body.permissions.canEdit
            ? PERMISSION_TYPES.EDIT
            : PERMISSION_TYPES.COMMENT

        await userMembership.save()

        SocketManager.getInstance().sendDocumentPermissionsChanged(
            document.id,
            userMembership.userId,
            userMembership.permissionsObject()
        )

        return res.status(200).json({
            success: true
        })
    }

    public RemoveFromMemberships = async (
        req: RemoveFromMembershipsRequest,
        res: RemoveFromMembershipsResponse
    ) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        await req.permissions.canRemoveMembersFromDocument(document)

        const userMembership = await PermissionsService.hasDocumentMembership({
            userId: req.params.memberId,
            documentId: req.params.documentId
        })

        if (userMembership == null) {
            res.status(404).send({
                message: 'User is not member of this document'
            })
            return
        }

        await userMembership.destroy()

        eventBusProducer.documentParticipantRemoved(
            req.invision.user.teamId,
            document.id,
            req.params.memberId
        )

        return res.status(200).json({
            success: true
        })
    }

    public GetAccessSettings = async (
        req: GetAccessSettingsRequest,
        res: GetAccessSettingsResponse
    ) => {
        const { team_id } = req.query

        const document = await Document.findDocument(
            req.params.documentId,
            team_id
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        const removeMembers = await req.permissions.canRemoveMembersFromDocument(
            document,
            false
        )

        return res.json({
            visibility: document.visibility,
            permissions: document.permissions,
            removeMembers
        })
    }

    public SetAccessSettings = async (
        req: SetAccessSettingsRequest,
        res: SetAccessSettingsResponse
    ) => {
        // @todo check if user has permissions to set access settings

        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        const { visibility, permissions } = req.body

        document.visibility = visibility
        document.permissions = permissions

        await document.save()

        return res.json({
            visibility,
            permissions
        })
    }

    public GetPermissions = async (
        req: GetPermissionsRequest,
        res: GetPermissionsResponse
    ) => {
        const { teamId, userId } = req.invision.user
        const document = await Document.findDocument(
            req.params.documentId,
            teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        const membership = await getMembershipPermissions(userId, teamId)
        return res.json(membership)
    }

    public GetPermissionsForDocuments = async (
        req: GetPermissionsForDocumentsRequest,
        res: GetPermissionsForDocumentsResponse
    ) => {
        const permissions = await getMembershipPermissionsForDocuments(
            req.invision.user.userId,
            req.query.documentIds
        )
        res.status(200).send(permissions)
        return
    }

    public GetDocumentThumbnail = async (
        req: GetDocumentThumbnailRequest,
        res: GetDocumentThumbnailResponse
    ) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )

        if (document == null) {
            res.status(404).send({ message: 'Document not found' })
            return
        }

        if (!document.thumbnailAssetKey) {
            res.status(404).send({ message: 'Thumbnail not found' })
            return
        }
        // get urls from assets api
        const assetsApiService = new AssetsApiService(req)
        const thumbnail = await assetsApiService.getAssetFromAssetKey(
            document.thumbnailAssetKey,
            req.tracing
        )
        if (thumbnail == null) {
            throw new Error('Unable to get thumbnail from assets api')
        }
        res.status(200).send(thumbnail)
    }

    private UpdateIsSubscribed = async (
        req: SubscribeToDocumentRequest,
        res: SubscribeToDocumentResponse,
        isSubscribed: boolean
    ) => {
        const document = await Document.findDocument(
            req.params.documentId,
            req.invision.user.teamId
        )
        if (!document) {
            return res.status(404).send({ message: 'Document not found' })
        }

        await req.permissions.canCommentOnDocument(document)

        const userMembership = await PermissionsService.hasDocumentMembership({
            userId: req.invision.user.userId,
            documentId: document.id
        })

        if (!userMembership) {
            return res
                .status(404)
                .send({ message: 'User is not member of given document' })
        }

        userMembership.isSubscribed = isSubscribed
        await userMembership.save()

        if (isSubscribed) {
            analytics.track(
                analytics.DOCUMENT_FOLLOWED,
                req.invision.user.userId,
                req.params.documentId,
                req.invision.user.vendorId,
                req.invision.user.teamId,
                {
                    teamId: req.invision.user.teamId,
                    method: analytics.DOCUMENT_FOLLOWED_METHODS.manual
                }
            )
        }

        return res.status(200).json({
            success: true
        })
    }

    public SubscribeToDocument = async (
        req: SubscribeToDocumentRequest,
        res: SubscribeToDocumentResponse
    ) => {
        return this.UpdateIsSubscribed(req, res, true)
    }

    public UnsubscribeFromDocument = async (
        req: UnsubscribeFromDocumentRequest,
        res: UnsubscribeFromDocumentResponse
    ) => {
        return this.UpdateIsSubscribed(req, res, false)
    }

    public EmitGenericEvent = (
        req: EmitGenericEventRequest,
        res: EmitGenericEventResponse
    ) => {
        SocketManager.getInstance().sendGenericEvent(
            req.body.event,
            req.params.documentId
        )
        return res.status(200).json({
            success: true
        })
    }

    init() {
        this.router.get(
            '/',
            createMetrics('/v1/documents'),
            asyncify(this.ListDocuments)
        )
        this.router.post(
            '/new',
            createMetrics('/v1/documents'),
            validate(createDocumentValidation),
            asyncify(this.CreateDocument)
        )
        this.router.get(
            '/permissions',
            createMetrics('/v1/documents'),
            validate(getPermissionsForDocumentsValidation),
            this.GetPermissionsForDocuments
        )
        this.router.get(
            '/:documentId',
            createMetrics('/v1/documents'),
            validate(getDocumentValidation),
            this.GetDocument
        )
        this.router.get(
            '/:documentId/revisions',
            createMetrics('/v1/documents'),
            validate(getDocumentRevisionsValidation),
            this.GetDocumentRevisions
        )
        this.router.get(
            '/:documentId/revisions/:revision',
            createMetrics('/v1/documents'),
            validate(getDocumentAtRevisionValidation),
            this.GetDocumentAtRevision
        )
        this.router.get(
            '/:documentId/html',
            createMetrics('/v1/documents'),
            validate(getDocumentHtmlValidation),
            asyncify(this.GetDocumentHtml)
        )
        this.router.get(
            '/:documentId/text',
            createMetrics('/v1/documents'),
            validate(getDocumentTextValidation),
            asyncify(this.GetDocumentText)
        )
        this.router.post(
            '/:documentId/archive',
            createMetrics('/v1/documents'),
            validate(archiveDocumentValidation),
            asyncify(this.ArchiveDocument)
        )
        this.router.post(
            '/:documentId/unarchive',
            createMetrics('/v1/documents'),
            validate(unarchiveDocumentValidation),
            asyncify(this.UnarchiveDocument)
        )
        this.router.get(
            '/:documentId/revisionsSinceRevision/:revisionNum',
            createMetrics('/v1/documents'),
            asyncify(this.GetRevisionsSinceRevision)
        )
        this.router.get(
            '/:documentId/memberships',
            createMetrics('/v1/documents'),
            asyncify(this.GetMemberships)
        )
        this.router.post(
            '/:documentId/memberships/add',
            createMetrics('/v1/documents'),
            validate(addToMembershipsValidation),
            asyncify(this.AddMembersToMemberships)
        )
        this.router.post(
            '/:documentId/memberships/:memberId',
            createMetrics('/v1/documents'),
            validate(updateMembershipsValidation),
            asyncify(this.UpdateMemberships)
        )
        this.router.delete(
            '/:documentId/memberships/:memberId',
            createMetrics('/v1/documents'),
            validate(removeFromMembershipsValidation),
            asyncify(this.RemoveFromMemberships)
        )
        this.router.use('/:documentId/assets', AssetController)
        this.router.get(
            '/:documentId/access-settings',
            createMetrics('/v1/documents'),
            asyncify(this.GetAccessSettings)
        )
        this.router.get(
            '/:documentId/permissions',
            createMetrics('/v1/documents'),
            asyncify(this.GetPermissions)
        )
        this.router.post(
            '/:documentId/access-settings',
            createMetrics('/v1/documents'),
            validate(setAccessSettingsValidation),
            asyncify(this.SetAccessSettings)
        )
        this.router.get(
            '/:documentId/thumbnail',
            createMetrics('/v1/documents'),
            validate(getDocumentThumbnailValidation),
            asyncify(this.GetDocumentThumbnail)
        )
        this.router.post(
            '/:documentId/subscribe',
            createMetrics('/v1/documents'),
            validate(subscribeToDocumentValidation),
            asyncify(this.SubscribeToDocument)
        )
        this.router.post(
            '/:documentId/unsubscribe',
            createMetrics('/v1/documents'),
            validate(unsubscribeFromDocumentValidation),
            asyncify(this.UnsubscribeFromDocument)
        )
    }
}

const documentController = new DocumentController()
documentController.init()

export default documentController.router as Router
