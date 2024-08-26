import { compact, find, reject, uniq } from 'lodash'
import { IFindOptions, Sequelize } from 'sequelize-typescript'
import { Config } from '../config'
import { getDocumentUrlPath } from '../controllers/utils'
import { FreehandHeaders } from '../interfaces/FreehandHeaders'
import { ReducedRequest } from '../interfaces/ReducedRequest'
import { User } from '../interfaces/User'
import { Document } from '../models/Document'
import { DocumentMembership } from '../models/DocumentMembership'
import { DocumentRevision } from '../models/DocumentRevision'
import * as DeltaSlice from '../util/DeltaSlice'
import { markUpdates } from '../util/JSON1Diff'
import { QuillDeltaConverter } from '../util/QuillDeltaConverter'
import { EmailTemplateType } from './EmailerApiService'
import { UsersApiService } from './UsersApiService'
import { EmailTemplate } from './EmailSender'

async function getSubscribedMembers(
    documentId: string,
    request: ReducedRequest
): Promise<User[] | null> {
    if (Config.environment === 'local') {
        const fakeUser = { userId: 1 } as User
        return [fakeUser]
    }

    const subscribedMembers = await DocumentMembership.getSubscribedMembers(
        documentId
    )

    if (subscribedMembers.length < 1) {
        return null
    }

    const memberIds = subscribedMembers.map((member) => member.userId)

    const usersApiService = new UsersApiService(request)
    const subscribedUsers = await usersApiService.getUserProfilesForAdmin(
        memberIds,
        request.tracing
    )
    if (subscribedUsers.length < 1) {
        throw new Error(
            'DocumentUpdateEmail#getSubscribedMembers - Unable to get user profiles from users-api'
        )
    }

    return subscribedUsers
}

async function getRecipients(
    documentId: string,
    revision: number,
    members: User[]
) {
    // We're now checking for authorship based on the revision and not the delta
    const query: IFindOptions<DocumentRevision> = {
        where: {
            documentId,
            revision: {
                [Sequelize.Op.gt]: revision
            }
        },
        attributes: [
            Sequelize.fn('DISTINCT', Sequelize.col('userId')),
            'userId',
            'delta'
        ]
    }

    // We only want revisions that contain inserts
    const slicesAuthors = await DocumentRevision.findAll(query)

    let authorIds: number[] = uniq(
        compact(
            slicesAuthors.map((item: DocumentRevision) => {
                if (item.delta.ops.find((op) => !!op.insert)) {
                    return item.userId
                }

                return null
            })
        )
    )

    // exclude user from members list if he is only one who made the changes
    if (authorIds.length === 1) {
        const authorId = authorIds[0]
        return reject(members, { userId: authorId })
    }

    return members
}

export async function create(
    documentId: string,
    revision: number,
    request: ReducedRequest,
    headers: FreehandHeaders,
    panes?: { [paneId: string]: number }
): Promise<EmailTemplate | undefined> {
    const user: User = request.invision.user

    // get document and document contents
    const document = await Document.findDocument(documentId, user.teamId)
    if (document == null) {
        throw new Error('DocumentUpdateEmail#create - Document not found')
    }

    // If there are pane updates build those
    let paneUpdates = {}
    if (panes) {
        for (const paneId in panes) {
            paneUpdates[paneId] = await markUpdates(
                paneId,
                user.teamId,
                panes[paneId]
            )
        }
    }

    // get slices
    const slices = await DeltaSlice.getSlices(document, revision, paneUpdates)
    if (slices == null) {
        return
    }

    // get subscribed document members
    const subscribedMembers = await getSubscribedMembers(documentId, request)
    if (subscribedMembers == null) {
        return
    }

    const slicesAuthors = DeltaSlice.getSlicesAuthorIds(slices)
    let authorship: string[] = []

    // get html for slices
    const updatesPromises = slices.map((slice, i) => {
        const converter = new QuillDeltaConverter(
            user,
            headers,
            request.tracing
        )
        let authors: string[] = []
        slicesAuthors[i].forEach((id) => {
            const author = find(subscribedMembers, { userId: id })
            if (author) {
                authors.push(author.name)
            }
        })
        authorship[i] = converter.convertAuthorship(authors)
        return converter.convert(document, slice.ops!, paneUpdates, {
            renderEmojiAsImage: true,
            includeStyles: true
        })
    })
    const updates = await Promise.all(updatesPromises)
    const recipients = await getRecipients(
        documentId,
        revision,
        subscribedMembers
    )
    if (recipients.length === 0) {
        return
    }

    return {
        type: EmailTemplateType.RhombusDocumentUpdates,
        from: `InVision App <${Config.senderEmail}>`,
        recipients,
        subject: `What's new in “${document.title}”`,
        templateVariables: {
            document_title: document.title,
            document_url: `https://${headers.hostname}${getDocumentUrlPath(
                document
            )}`,
            updates,
            authorship
        }
    }
}
