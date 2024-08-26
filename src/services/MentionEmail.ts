import * as Delta from 'quill-delta'
import * as json1 from 'ot-json1'
import { UsersApiService } from './UsersApiService'
import { Document } from '../models/Document'
import { transformDocumentOperation } from '../models/DocumentRevision'
import {
    getSurroundingDelta,
    getPaneSurroundingDelta
} from '../util/SurroundingDelta'
import {
    QuillDeltaConverter,
    RetrievedPanes
} from '../util/QuillDeltaConverter'
import { FreehandHeaders } from '../interfaces/FreehandHeaders'
import { Mention } from '../interfaces/Mention'
import { Config } from '../config'
import { getDocumentUrlPath } from '../controllers/utils'
import { LaunchDarklyHelper } from '../util/LaunchDarklyHelper'
import { Logger } from '../util/Logger'
import { Permissions } from '../middleware/Permissions'
import { ReducedRequest } from '../interfaces/ReducedRequest'
import { User } from '../interfaces/User'
import { EmailTemplate } from './EmailSender'
import { EmailTemplateType } from './EmailerApiService'
import {
    isPaneMentionOperation,
    transformPaneOperation
} from '../models/PaneRevision'
import { Pane } from '../models/Pane'
import { PaneList, PaneElement } from 'src/interfaces/PaneContents'

async function getUpdatedMentionDeltaWithNewerRevisions(
    document: Document,
    revision: number
): Promise<Delta> {
    // In the case where we've submitted a revision number that is behind the
    // current revision (or equal) we need to get the missing revisions and
    // merge them in.
    const currentRevision = await document.getRevision(revision)
    if (!currentRevision) {
        throw new Error(
            `MentionEmail#document couldn't find mention revision: ${revision}`
        )
    }

    const concurrentRevisions = await document.getRevisionsAfterRevision(
        revision
    )

    return transformDocumentOperation(
        new Delta(currentRevision.delta),
        concurrentRevisions
    )
}

async function getUpdatedMentionPaneOpWithNewerRevisions(
    pane: Pane,
    revision: number
): Promise<json1.JSONOp> {
    // In the case where we've submitted a revision number that is behind the
    // current revision (or equal) we need to get the missing revisions and
    // merge them in.
    const currentRevision = await pane.getRevision(revision)
    if (!currentRevision) {
        throw new Error(
            `MentionEmail#pane couldn't find mention revision: ${revision}`
        )
    }

    const concurrentRevisions = await pane.getRevisionsAfterRevision(revision)

    return transformPaneOperation(
        currentRevision.operation,
        concurrentRevisions
    )
}

function getMentionFromPaneOperation(
    operation: json1.JSONOp
): Mention | undefined {
    if (!isPaneMentionOperation(operation)) {
        return
    }

    const editOp = operation[5] as json1.JSONOpComponent
    const delta = editOp.e
    const ops = delta.ops
    let insert
    if (ops.length === 1) {
        insert = ops[0].insert
    } else {
        insert = ops[1].insert
    }

    return insert.mention || insert['document-mention']
}

function getRowAndColumn(operation: json1.JSONOp) {
    return {
        row: operation[1] as number,
        column: operation[3] as number
    }
}

function mentionIsCurrentUser(mention: Mention, userId: number) {
    return !mention.documentMention && mention.id === userId
}

export async function getPaneMention(
    document: Document,
    userId: number,
    teamId: string,
    paneId: string,
    revision: number
) {
    const pane = await Pane.findPane(paneId, teamId)
    if (!pane) {
        return
    }

    const operation = await getUpdatedMentionPaneOpWithNewerRevisions(
        pane,
        revision
    )

    const mention = getMentionFromPaneOperation(operation)
    if (!mention) {
        return
    }

    // don't send email if mentioned user is current user
    if (mentionIsCurrentUser(mention, userId)) {
        return
    }

    const documentContents = await document.contents()

    // get surrounding delta
    const surroundingDelta = getPaneSurroundingDelta(
        documentContents.delta,
        paneId
    )
    if (!surroundingDelta) {
        return
    }

    // get pane contents
    const paneContents = await pane.contents()

    // set hasUpdates flag
    const { row, column } = getRowAndColumn(operation)
    const paneList = paneContents.contents.elements[row] as PaneList
    const paneElement = paneList.elements[column] as PaneElement
    paneElement.hasUpdates = true

    return {
        mention,
        delta: surroundingDelta,
        paneContents: paneContents.contents
    }
}

export async function getDocumentMention(
    document: Document,
    userId: number,
    revision: number
) {
    // gets updated mention delta to account for any new changes to doc after mention was put in queue
    let mentionDelta: Delta = await getUpdatedMentionDeltaWithNewerRevisions(
        document,
        revision
    )

    const { retain, mention } = validateMentionDelta(mentionDelta)

    // dont send email if mentioned user is current user
    if (mentionIsCurrentUser(mention, userId)) {
        return
    }

    const documentContents = await document.contents()

    // get surrounding delta
    const surroundingDelta = getSurroundingDelta(documentContents.delta, retain)
    if (!surroundingDelta) {
        return
    }

    return {
        mention,
        delta: surroundingDelta
    }
}

export async function create(
    documentId: string,
    paneId: string | undefined,
    revision: number,
    request: ReducedRequest,
    headers: FreehandHeaders
): Promise<EmailTemplate | undefined> {
    const user: User = request.invision.user

    // get document and document contents
    const document = await Document.findDocument(documentId, user.teamId)

    if (document == null) {
        throw new Error('MentionEmail#sendMentioned - Document not found')
    }

    // get mention and surrounding delta
    let mention: Mention
    let surroundingDelta: Delta
    const paneUpdates: RetrievedPanes = {}

    if (paneId) {
        const paneMention = await getPaneMention(
            document,
            user.userId,
            user.teamId,
            paneId,
            revision
        )
        if (!paneMention) {
            return
        }
        mention = paneMention.mention
        surroundingDelta = paneMention.delta
        paneUpdates[paneId] = paneMention.paneContents
    } else {
        const documentMention = await getDocumentMention(
            document,
            user.userId,
            revision
        )
        if (!documentMention) {
            return
        }
        mention = documentMention.mention
        surroundingDelta = documentMention.delta
    }

    // get mentioned users
    const mentionedUsers = await getMentionedUsers(mention, document, request)
    if (mentionedUsers == null) {
        return
    }

    // get current user profile
    const usersApiService = new UsersApiService(request)
    const currentUserProfile = await usersApiService.getUserProfile(
        user.userId,
        request.tracing
    )
    if (currentUserProfile == null) {
        throw new Error(
            'MentionEmail#sendMentioned - Unable to get user profile from users-api'
        )
    }

    // convert surrounding delta to html
    const converter = new QuillDeltaConverter(user, headers, request.tracing)
    const html = await converter.convert(
        document,
        surroundingDelta.ops!,
        paneUpdates,
        {
            renderEmojiAsImage: true,
            includeStyles: true
        }
    )

    // prepare template data
    const from = `InVision App <${Config.senderEmail}>`
    const subject = `New mention in “${document.title}”`
    const documentUrl = `https://${headers.hostname}${getDocumentUrlPath(
        document
    )}`

    const recipients = mentionedUsers.filter((mentionedUser) => {
        return mentionedUser.userId !== currentUserProfile.userId
    })

    if (recipients.length < 1) {
        return
    }

    return {
        from,
        recipients,
        subject,
        type: EmailTemplateType.RhombusMentionNotification,
        templateVariables: {
            user_name: currentUserProfile.name,
            user_avatar: currentUserProfile.avatarUrl,
            document_title: document.title,
            document_url: documentUrl,
            mention_content: html
        }
    }
}

async function getMentionedUsers(
    mention: Mention,
    document: Document,
    request: ReducedRequest
) {
    const logger = Logger

    const usersApiService = new UsersApiService(request)
    if (mention.documentMention) {
        const members = await document.members()
        const memberIds = members.map((member) => {
            return member.userId
        })
        const mentionedUsers = await usersApiService.getUserProfilesForAdmin(
            memberIds,
            request.tracing
        )
        if (mentionedUsers.length < 1) {
            throw new Error(
                'MentionEmail#sendMentioned - Unable to get user profiles from users-api'
            )
        }
        return mentionedUsers
    } else {
        const mentionedUser = await usersApiService.getUserProfile(
            mention.id,
            request.tracing
        )

        if (mentionedUser == null) {
            throw new Error(
                'MentionEmail#sendMentioned - Unable to get user profile from users-api'
            )
        }

        if (Config.enableLD) {
            const hasAccess = await LaunchDarklyHelper.getInstance().getFeatureFlagByUserAndTeamId(
                LaunchDarklyHelper.HAS_ACCESS,
                mentionedUser.email,
                mentionedUser.teamId
            )
            if (!hasAccess) {
                logger.debug(
                    `EmailSender - Rejecting user because they are not enabled in the ${LaunchDarklyHelper.HAS_ACCESS} feature flag`
                )
                return
            }
        }

        // Can't use mentionedUser if it doesn't have permission to view the document
        let permission = new Permissions(
            mentionedUser.userId,
            document.teamId,
            request
        )
        let hasPermission = await permission.canSendMentionForDocument(document)
        if (!hasPermission) {
            throw new Error(
                'MentionEmail#sendMentioned - User does not have permission to view document'
            )
        }

        return [mentionedUser]
    }
}

export function validateMentionDelta(mentionDelta: Delta.DeltaStatic) {
    const ops = mentionDelta.ops
    if (ops == null || ops.length < 2) {
        throw new Error(
            'MentionEmail#validateMentionDelta - Invalid mention delta - no operations'
        )
    }

    const retain = ops[0].retain
    if (retain == null) {
        throw new Error(
            'MentionEmail#validateMentionDelta - Invalid mention delta - missing retain operation'
        )
    }

    const insert = ops[1].insert
    if (insert == null) {
        throw new Error(
            'MentionEmail#validateMentionDelta - Invalid mention delta - missing insert operation'
        )
    }

    const mention = insert.mention || insert['document-mention']
    if (mention == null) {
        throw new Error(
            'MentionEmail#validateMentionDelta - Invalid mention delta - missing mention'
        )
    }

    return {
        retain,
        mention
    }
}
