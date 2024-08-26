import PermissionsService from '../../../services/permissions/Service'
import {
    RequestMock,
    mockGetPermissionsForSpace,
    mockGetPermissionsForDocument,
    mockDocumentMembership
} from '../../utils'
import { PermissionsActions } from '../../../services/permissions/Actions'
import { Document } from '../../../models/Document'
import {
    VISIBILITY_TYPES,
    PERMISSION_TYPES,
    PermissionErrorReason
} from '../../../constants/AccessSettings'
import { IndexApiService } from '../../../services/IndexApiService'
import { DocumentMembership } from '../../../models/DocumentMembership'
import rules from '../../../services/permissions/Rules'

describe('PermissionsService', () => {
    describe('permissionsForDocuments', () => {
        it('should return permissions for documents', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const actions = [
                PermissionsActions.DOCUMENT_JOIN,
                PermissionsActions.DOCUMENT_ARCHIVE,
                PermissionsActions.DOCUMENT_CHANGE,
                PermissionsActions.DOCUMENT_DISCOVER
            ]

            // mock documents
            const document1 = {
                id: '1',
                visibility: VISIBILITY_TYPES.ALL,
                memberships: [
                    {
                        permissions: PERMISSION_TYPES.EDIT
                    }
                ]
            } as Document
            const document2 = {
                id: '2',
                visibility: VISIBILITY_TYPES.ALL,
                memberships: [
                    {
                        permissions: PERMISSION_TYPES.COMMENT
                    }
                ]
            } as Document
            const document3 = {
                id: '3',
                visibility: VISIBILITY_TYPES.ALL,
                memberships: [] as DocumentMembership[]
            } as Document
            const documents: Document[] = [document1, document2, document3]

            // mock GetPermissionsForDocument
            IndexApiService.prototype.GetPermissionsForDocument = jest.fn(
                () => {
                    return {
                        data: {
                            [document1.id]: {
                                [PermissionsActions.DOCUMENT_JOIN]: {
                                    allow: true,
                                    force: true
                                },
                                [PermissionsActions.DOCUMENT_ARCHIVE]: {
                                    allow: true,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_CHANGE]: {
                                    allow: true,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_DISCOVER]: {
                                    allow: true,
                                    force: false
                                }
                            },
                            [document2.id]: {
                                [PermissionsActions.DOCUMENT_JOIN]: {
                                    allow: true,
                                    force: true
                                },
                                [PermissionsActions.DOCUMENT_ARCHIVE]: {
                                    allow: false,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_CHANGE]: {
                                    allow: true,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_DISCOVER]: {
                                    allow: true,
                                    force: true
                                }
                            },
                            [document3.id]: {
                                [PermissionsActions.DOCUMENT_JOIN]: {
                                    allow: true,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_ARCHIVE]: {
                                    allow: true,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_CHANGE]: {
                                    allow: true,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_DISCOVER]: {
                                    allow: false,
                                    force: true
                                }
                            }
                        }
                    }
                }
            )

            // verify result
            const permissions = await new PermissionsService(
                userId,
                teamId,
                request
            ).permissionsForDocuments(documents, actions)

            expect(permissions).toEqual({
                [document1.id]: {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: true,
                        force: true
                    },
                    [PermissionsActions.DOCUMENT_ARCHIVE]: {
                        allow: true,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_CHANGE]: {
                        allow: true,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_DISCOVER]: {
                        allow: true,
                        force: false
                    }
                },
                [document2.id]: {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: true,
                        force: true
                    },
                    [PermissionsActions.DOCUMENT_ARCHIVE]: {
                        allow: false,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_CHANGE]: {
                        allow: false,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_DISCOVER]: {
                        allow: true,
                        force: true
                    }
                },
                [document3.id]: {
                    [PermissionsActions.DOCUMENT_JOIN]: {
                        allow: true,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_ARCHIVE]: {
                        allow: false,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_CHANGE]: {
                        allow: false,
                        force: false
                    },
                    [PermissionsActions.DOCUMENT_DISCOVER]: {
                        allow: false,
                        force: true
                    }
                }
            })
        })

        it('should handle bad index api responses', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            IndexApiService.prototype.GetPermissionsForDocument = jest.fn(
                () => {
                    return {}
                }
            )

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).permissionsForDocuments(
                [document],
                [PermissionsActions.DOCUMENT_ADD_MEMBERS]
            )

            expect(permissionRes).toBeUndefined()
        })
    })

    describe('canSubmitOperationForDocument', () => {
        it('should get permission for submit operation', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            const ruleSpy = jest
                .spyOn(rules, PermissionsActions.DOCUMENT_CHANGE)
                .mockClear()

            mockDocumentMembership(PERMISSION_TYPES.EDIT)

            IndexApiService.prototype.GetPermissionsForDocument = jest.fn()

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).canSubmitOperationForDocument(document)
            expect(permissionRes).toBeUndefined()
            expect(
                IndexApiService.prototype.GetPermissionsForDocument
            ).not.toBeCalled()
            expect(DocumentMembership.findOne).toBeCalled()
            expect(ruleSpy).toBeCalled()
        })

        it('should return error when user does not have permission', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            DocumentMembership.findOne = jest.fn(() => {
                return
            })

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).canSubmitOperationForDocument(document)

            expect(permissionRes).toBe(
                PermissionErrorReason.DOCUMENT_MEMBERSHIP
            )
            expect(DocumentMembership.findOne).toBeCalled()
        })
    })

    describe('hasPermissionForDocument', () => {
        it('should get permission for document', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            const ruleSpy = jest
                .spyOn(rules, PermissionsActions.DOCUMENT_ADD_MEMBERS)
                .mockClear()
            mockGetPermissionsForDocument(document, {
                [PermissionsActions.DOCUMENT_ADD_MEMBERS]: {
                    allow: true,
                    force: false
                }
            })
            mockDocumentMembership(PERMISSION_TYPES.EDIT)

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForDocument(
                PermissionsActions.DOCUMENT_ADD_MEMBERS,
                document
            )
            expect(permissionRes).toBeUndefined()
            expect(
                IndexApiService.prototype.GetPermissionsForDocument
            ).toBeCalled()
            expect(DocumentMembership.findOne).toBeCalled()
            expect(ruleSpy).toBeCalled()
        })

        it('should handle forced external permission for document', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            const ruleSpy = jest
                .spyOn(rules, PermissionsActions.DOCUMENT_ADD_MEMBERS)
                .mockClear()
            const membershipSpy = jest
                .spyOn(DocumentMembership, 'findOne')
                .mockClear()
            mockGetPermissionsForDocument(document, {
                [PermissionsActions.DOCUMENT_ADD_MEMBERS]: {
                    allow: true,
                    force: true
                }
            })

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForDocument(
                PermissionsActions.DOCUMENT_ADD_MEMBERS,
                document
            )
            expect(permissionRes).toBeUndefined()
            expect(
                IndexApiService.prototype.GetPermissionsForDocument
            ).toBeCalled()
            expect(membershipSpy).not.toBeCalled()
            expect(ruleSpy).not.toBeCalled()
        })

        it('should handle bad index api responses', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            IndexApiService.prototype.GetPermissionsForDocument = jest.fn(
                () => {
                    return {
                        data: {}
                    }
                }
            )

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForDocument(
                PermissionsActions.DOCUMENT_ADD_MEMBERS,
                document
            )

            expect(permissionRes).toBe(PermissionErrorReason.EXTERNAL)
        })

        it('should return error when force external permission is false', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            mockGetPermissionsForDocument(document, {
                [PermissionsActions.DOCUMENT_ADD_MEMBERS]: {
                    allow: false,
                    force: true
                }
            })

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForDocument(
                PermissionsActions.DOCUMENT_ADD_MEMBERS,
                document
            )

            expect(permissionRes).toBe(PermissionErrorReason.EXTERNAL)
        })

        it('should return error when user doesnt have permission', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            mockGetPermissionsForDocument(document, {
                [PermissionsActions.DOCUMENT_ADD_MEMBERS]: {
                    allow: false,
                    force: false
                }
            })
            DocumentMembership.findOne = jest.fn(() => {
                return
            })

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForDocument(
                PermissionsActions.DOCUMENT_ADD_MEMBERS,
                document
            )

            expect(permissionRes).toBe(
                PermissionErrorReason.DOCUMENT_MEMBERSHIP
            )
            expect(DocumentMembership.findOne).toBeCalled()
        })

        it('should return external permission if there is no local permission', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const document = {
                id: '1'
            } as Document

            mockGetPermissionsForDocument(document, {
                [PermissionsActions.DOCUMENT_CREATE]: {
                    allow: true,
                    force: false
                }
            })
            DocumentMembership.findOne = jest.fn()

            const permissionRes1 = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForDocument(
                PermissionsActions.DOCUMENT_CREATE,
                document
            )

            expect(permissionRes1).toBeUndefined()
            expect(DocumentMembership.findOne).not.toBeCalled()

            mockGetPermissionsForDocument(document, {
                [PermissionsActions.DOCUMENT_CREATE]: {
                    allow: false,
                    force: false
                }
            })

            const permissionRes2 = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForDocument(
                PermissionsActions.DOCUMENT_CREATE,
                document
            )

            expect(permissionRes2).toBe(PermissionErrorReason.EXTERNAL)
            expect(DocumentMembership.findOne).not.toBeCalled()
        })
    })

    describe('hasPermissionForSpace', () => {
        it('should get permission for space', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const spaceId = '1'

            mockGetPermissionsForSpace(spaceId, {
                [PermissionsActions.DOCUMENT_CREATE]: {
                    allow: true,
                    force: false
                }
            })

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForSpace(PermissionsActions.DOCUMENT_CREATE, spaceId)

            expect(permissionRes).toBeUndefined()
        })

        it('should return error when user doesnt have permission', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const spaceId = '1'

            mockGetPermissionsForSpace(spaceId, {
                [PermissionsActions.DOCUMENT_CREATE]: {
                    allow: false,
                    force: false
                }
            })

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForSpace(PermissionsActions.DOCUMENT_CREATE, spaceId)

            expect(permissionRes).toBe(PermissionErrorReason.EXTERNAL)
        })

        it('should handle bad index api responses', async () => {
            const request = RequestMock()
            const { userId, teamId } = request.invision.user
            const spaceId = '1'

            IndexApiService.prototype.GetPermissionsForSpace = jest.fn(() => {
                return {
                    data: {}
                }
            })

            const permissionRes = await new PermissionsService(
                userId,
                teamId,
                request
            ).hasPermissionForSpace(PermissionsActions.DOCUMENT_CREATE, spaceId)

            expect(permissionRes).toBe(PermissionErrorReason.EXTERNAL)
        })
    })
})
