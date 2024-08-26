import { Permissions } from '../../../middleware/Permissions'
import { Logger } from '../../../util/Logger'
import { Document } from '../../../models/Document'
import {
    VISIBILITY_TYPES,
    PermissionErrorReason,
    PERMISSION_TYPES
} from '../../../constants/AccessSettings'
import {
    MockRequest,
    mockGetPermissionsForDocument,
    mockDocumentMembership,
    mockGetPermissionsForSpace
} from '../../utils'
import { IndexApiService } from '../../../services/IndexApiService'
import { PermissionsActions } from '../../../services/permissions/Actions'

jest.mock('../../../models/Document')

const canViewDocumentSpy = jest.spyOn(Permissions.prototype, 'canViewDocument')
const canJoinDocumentSpy = jest.spyOn(Permissions.prototype, 'canJoinDocument')

async function mockThrowError() {
    throw new Error()
}

function getDocument() {
    const document = new Document()
    document.id = '1'
    return document
}

describe('Permissions', () => {
    beforeAll(() => {
        // Other files are affecting the mocks based on load order or
        // something that we don't understand so these have to be mocked
        // inside the beforeAll for some reason.
        jest.mock('../../../models/DocumentMembership')
        jest.mock('../../../services/IndexApiService')
    })

    Logger.debug = jest.fn(() => {})
    Logger.error = jest.fn(() => {})

    describe('Individual permission checks', () => {
        describe('canJoinAndViewDocument', () => {
            it('Should return true when forced to true', async () => {
                const document = getDocument()
                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: true,
                        force: true
                    },
                    [PermissionsActions.DOCUMENT_VIEW]: {
                        allow: true,
                        force: false
                    }
                })
                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canJoinAndViewDocument(document)
                ).resolves.toEqual(true)
            })

            it('Should return error when forced to false', async () => {
                const document = getDocument()
                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: false,
                        force: true
                    },
                    [PermissionsActions.DOCUMENT_VIEW]: {
                        allow: true,
                        force: false
                    }
                })

                const permissions = new Permissions(0, '', MockRequest)
                try {
                    await permissions.canJoinAndViewDocument(document)
                } catch (e) {
                    expect(e.name).toEqual('Permissions Error')
                    expect(e.reason).toEqual(PermissionErrorReason.EXTERNAL)
                }
            })

            it('Should return error when user doesnt have document visibility permissions', async () => {
                const document = getDocument()
                document.visibility = VISIBILITY_TYPES.INVITE

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: true,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_VIEW]: {
                        allow: true,
                        force: false
                    }
                })

                const permissions = new Permissions(0, '', MockRequest)
                try {
                    await permissions.canJoinAndViewDocument(document)
                } catch (e) {
                    expect(e.name).toEqual('Permissions Error')
                    expect(e.reason).toEqual(
                        PermissionErrorReason.DOCUMENT_MEMBERSHIP
                    )
                }
            })

            it('Should return true when all permissions pass', async () => {
                const document = getDocument()
                document.visibility = VISIBILITY_TYPES.ALL

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: true,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_VIEW]: {
                        allow: true,
                        force: false
                    }
                })

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canJoinAndViewDocument(document)
                ).resolves.toEqual(true)
            })

            it('Should return true when external allow and visibility is team', async () => {
                const document = getDocument()
                document.visibility = VISIBILITY_TYPES.TEAM

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: true,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_VIEW]: {
                        allow: true,
                        force: false
                    }
                })

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canJoinAndViewDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canAddMembersToDocument', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_ADD_MEMBERS]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canAddMembersToDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canViewDocument', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_VIEW]: {
                        allow: false,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canViewDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canJoinDocument', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()
                document.visibility = VISIBILITY_TYPES.ALL

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: false,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canJoinDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canSendMentionForDocument', () => {
            beforeEach(() => {
                jest.resetAllMocks()
            })

            it('Should return false if both checks fail', async () => {
                canViewDocumentSpy.mockImplementationOnce(mockThrowError)
                canJoinDocumentSpy.mockImplementationOnce(mockThrowError)

                const document = getDocument()
                const permissions = new Permissions(0, '', MockRequest)
                let canSendMention = await permissions.canSendMentionForDocument(
                    document
                )
                expect(canSendMention).toBeFalsy()
                expect(canViewDocumentSpy).toBeCalled()
                expect(canJoinDocumentSpy).toBeCalled()
            })

            it('Should return true if only the first check passes', async () => {
                canViewDocumentSpy.mockImplementationOnce(async () => true)
                canJoinDocumentSpy.mockImplementationOnce(mockThrowError)

                const document = getDocument()
                const permissions = new Permissions(0, '', MockRequest)
                let canSendMention = await permissions.canSendMentionForDocument(
                    document
                )
                expect(canSendMention).toBeTruthy()
                expect(canViewDocumentSpy).toBeCalled()
                expect(canJoinDocumentSpy).not.toBeCalled()
            })

            it('Should return true if only the second check passes', async () => {
                canViewDocumentSpy.mockImplementationOnce(mockThrowError)
                canJoinDocumentSpy.mockImplementationOnce(async () => true)
                const document = getDocument()
                const permissions = new Permissions(0, '', MockRequest)
                let canSendMention = await permissions.canSendMentionForDocument(
                    document
                )
                expect(canSendMention).toBeTruthy()
                expect(canViewDocumentSpy).toBeCalled()
                expect(canJoinDocumentSpy).toBeCalled()
            })
        })

        describe('canRemoveMembersFromDocument', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_REMOVE_MEMBERS]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canRemoveMembersFromDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canArchiveDocument', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_ARCHIVE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canArchiveDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canChangeDocument', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_ARCHIVE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canChangeDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canCommentOnDocument', () => {
            it('Should return true when all permissions pass and canEdit', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_COMMENT]: {
                        allow: false,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canCommentOnDocument(document)
                ).resolves.toEqual(true)
            })

            it('Should return true when all permissions pass and canComment', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_COMMENT]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.COMMENT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canCommentOnDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canPrivateCommentOnDocument', () => {
            it('Should return true when all permissions pass and canEdit', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_PRIVATE_COMMENT]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canPrivateCommentOnDocument(document)
                ).resolves.toEqual(true)
            })

            it('Should return true when all permissions pass and canComment', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_PRIVATE_COMMENT]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.COMMENT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canPrivateCommentOnDocument(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canDeleteComment', () => {
            it('Should return true when all permissions pass and canEdit', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_DELETE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canDeleteComment(document)
                ).resolves.toEqual(true)
            })

            it('Should return true when all permissions pass and canComment', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_DELETE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.COMMENT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canDeleteComment(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canResolveComment', () => {
            it('Should return true when all permissions pass and canEdit', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_RESOLVE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canResolveComment(document)
                ).resolves.toEqual(true)
            })

            it('Should return true when all permissions pass and canComment', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_RESOLVE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.COMMENT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canResolveComment(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canChangeComment', () => {
            it('Should return true when all permissions pass and canEdit', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_CHANGE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canChangeComment(document)
                ).resolves.toEqual(true)
            })

            it('Should return true when all permissions pass and canComment', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_CHANGE]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.COMMENT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canChangeComment(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canEditDocumentLinkSettings', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_MANAGE_PUBLIC_LINK]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canEditDocumentLinkSettings(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canMentionDocumentMember', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_MENTION_DOCUMENT_MEMBER]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canMentionDocumentMember(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canMentionTeamMember', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.COMMENT_MENTION_TEAM_MEMBER]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canMentionTeamMember(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canInviteGuest', () => {
            it('Should return true when all permissions pass', async () => {
                const document = getDocument()

                mockGetPermissionsForDocument(document, {
                    [PermissionsActions.DOCUMENT_ADD_GUESTS]: {
                        allow: true,
                        force: false
                    }
                })
                mockDocumentMembership(PERMISSION_TYPES.EDIT)

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canInviteGuest(document)
                ).resolves.toEqual(true)
            })
        })

        describe('canCreateDocument', () => {
            it('Should return true when all permissions pass', async () => {
                const spaceId = '0'
                mockGetPermissionsForSpace(spaceId, {
                    [PermissionsActions.DOCUMENT_CREATE]: {
                        allow: true,
                        force: false
                    }
                })

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canCreateDocument(spaceId)
                ).resolves.toEqual(true)
            })

            it('Should default to a space id of 0', async () => {
                const spaceId = '0'
                mockGetPermissionsForSpace(spaceId, {
                    [PermissionsActions.DOCUMENT_CREATE]: {
                        allow: true,
                        force: false
                    }
                })

                const permissions = new Permissions(0, '', MockRequest)
                await expect(
                    permissions.canCreateDocument(undefined)
                ).resolves.toEqual(true)
                expect(
                    IndexApiService.prototype.GetPermissionsForSpace
                ).toBeCalledWith(
                    PermissionsActions.DOCUMENT_CREATE,
                    0,
                    '',
                    '0',
                    MockRequest.tracing
                )
            })
        })

        describe('canSubmitOperation', () => {
            it('should return true when all permissions pass', async () => {
                const document = getDocument()
                const permissions = new Permissions(0, '', MockRequest)
                permissions.permissionsService.canSubmitOperationForDocument = jest.fn(
                    () => {
                        return Promise.resolve()
                    }
                )
                await expect(
                    permissions.canSubmitOperation(document)
                ).resolves.toEqual(true)
            })

            it('should throw permissions error when there is error from permission service', async () => {
                const document = getDocument()
                const permissions = new Permissions(0, '', MockRequest)
                permissions.permissionsService.canSubmitOperationForDocument = jest.fn(
                    () => {
                        return Promise.resolve(
                            PermissionErrorReason.DOCUMENT_MEMBERSHIP
                        )
                    }
                )

                try {
                    await permissions.canSubmitOperation(document)
                } catch (e) {
                    expect(e.name).toEqual('Permissions Error')
                    expect(e.reason).toEqual(
                        PermissionErrorReason.DOCUMENT_MEMBERSHIP
                    )
                }
            })
        })
    })
})
