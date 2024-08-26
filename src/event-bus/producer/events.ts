import { QueueTaskPusher } from '../../util/QueueManager'
import { THIRTY_SECONDS_IN_MS } from '../../constants/Integers'

function emit(type: string, eventData: any, debounce?: number) {
    QueueTaskPusher.getInstance().emitEventBusEvent({
        type,
        eventData,
        debounce
    })
}

export function documentCreated(
    teamId: string,
    userId: number,
    documentId: string
) {
    return emit('document.created.v1', {
        teamId,
        userId,
        documentId
    })
}

export function documentUpdated(teamId: string, documentId: string) {
    return emit(
        'document.updated.v1',
        {
            teamId,
            documentId
        },
        THIRTY_SECONDS_IN_MS
    )
}

export function documentRenamed(teamId: string, documentId: string) {
    return emit('document.renamed.v1', {
        teamId,
        documentId
    })
}

export function documentDeleted(teamId: string, documentId: string) {
    return emit('document.deleted.v1', {
        teamId,
        documentId
    })
}

export function documentArchived(teamId: string, documentId: string) {
    return emit('document.archived.v1', {
        teamId,
        documentId
    })
}

export function documentRestored(teamId: string, documentId: string) {
    return emit('document.restored.v1', {
        teamId,
        documentId
    })
}

export function documentParticipantAdded(
    teamId: string,
    documentId: string,
    memberId: number
) {
    return emit('document.participant.added.v1', {
        teamId,
        documentId,
        memberId
    })
}

export function documentParticipantRemoved(
    teamId: string,
    documentId: string,
    memberId: number
) {
    return emit('document.participant.removed.v1', {
        teamId,
        documentId,
        memberId
    })
}

export function documentParticipantUpdated(
    teamId: string,
    documentId: string,
    memberId: number
) {
    return emit('document.participant.updated.v1', {
        teamId,
        documentId,
        memberId
    })
}

export function documentViewed(
    teamId: string,
    userId: number,
    documentId: string
) {
    return emit('document.viewed.v1', {
        teamId,
        userId,
        documentId
    })
}

export function documentThumbnailUpdated(teamId: string, documentId: string) {
    return emit('document.thumbnail.updated.v1', {
        teamId,
        documentId
    })
}
