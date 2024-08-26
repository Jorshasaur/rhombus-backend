import { Logger } from '../../../util/Logger'
import { PermissionsController } from '../../../controllers/Permissions/Controller'
import { PermissionsActions } from '../../../services/permissions/Actions'
import { RequestResponseMock } from '../../../test/utils'
import { Document } from '../../../models/Document'
import { PERMISSION_TYPES } from '../../../constants/AccessSettings'
import { IndexApiService } from '../../../services/IndexApiService'

const DOCUMENT_ID = '123'

const permissionResponse = {
    data: {
        [DOCUMENT_ID]: {
            [PermissionsActions.DOCUMENT_CREATE]: {
                allow: true,
                force: false
            },
            [PermissionsActions.DOCUMENT_ARCHIVE]: {
                allow: false,
                force: true
            },
            [PermissionsActions.DOCUMENT_CHANGE]: {
                allow: true,
                force: false
            },
            [PermissionsActions.DOCUMENT_DISCOVER]: {
                allow: true,
                force: false
            }
        }
    }
}

describe('PermissionsController', () => {
    Logger.debug = jest.fn(() => {
        /**/
    })
    Logger.error = jest.fn(() => {
        /**/
    })

    describe('Permissions', () => {
        it('Should return permissions', async () => {
            const requestResponseMock = new RequestResponseMock({
                query: {
                    actions: `${PermissionsActions.DOCUMENT_ARCHIVE},${PermissionsActions.DOCUMENT_CREATE},${PermissionsActions.DOCUMENT_CHANGE},${PermissionsActions.DOCUMENT_DISCOVER}`,
                    document_ids: DOCUMENT_ID
                }
            })

            Document.findAll = jest.fn(() => {
                return [
                    {
                        id: DOCUMENT_ID,
                        memberships: [
                            {
                                permissions: PERMISSION_TYPES.EDIT
                            }
                        ]
                    }
                ]
            })

            IndexApiService.prototype.GetPermissionsForDocument = jest.fn(
                () => {
                    return {
                        data: {
                            [DOCUMENT_ID]: {
                                [PermissionsActions.DOCUMENT_CREATE]: {
                                    allow: true,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_ARCHIVE]: {
                                    allow: false,
                                    force: true
                                },
                                [PermissionsActions.DOCUMENT_CHANGE]: {
                                    allow: false,
                                    force: false
                                },
                                [PermissionsActions.DOCUMENT_DISCOVER]: {
                                    allow: true,
                                    force: false
                                }
                            }
                        }
                    }
                }
            )

            await new PermissionsController().GetPermissions(
                requestResponseMock.request,
                requestResponseMock.response
            )
            expect(requestResponseMock.responseStatusCode).toEqual(200)
            expect(requestResponseMock.responseBody).toEqual(permissionResponse)
        })
    })
})
