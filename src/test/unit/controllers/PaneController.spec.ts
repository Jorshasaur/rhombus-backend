import { Permissions, PermissionsError } from '../../../middleware/Permissions'
import { PaneController } from '../../../controllers/Pane/Controller'
import { RequestResponseMock } from '../../utils'
import { Pane } from '../../../models/Pane'
import { PaneDocument } from '../../../models/PaneDocument'

const mockTransaction = Symbol('transaction')

const invision: any = {
    user: {
        teamId: 'cjcjeoi2w0000rn35c23q98ou',
        userId: '1',
        name: '',
        email: ''
    }
}

const pane = {
    contents: jest.fn(() => {
        return {
            revision: 1,
            contents: ['some cool pane contents']
        }
    }),
    id: 'the-best-pane-ever',
    getRevisionsAfterRevision: jest.fn(() => {
        return [
            {
                operation: [],
                revision: 15,
                userId: invision.user.userId,
                submissionId: '111-xxx-222',
                createdAt: new Date()
            }
        ]
    }),
    duplicate: jest.fn(() => {
        return 'im-a-derpricated-pane'
    })
}

jest.mock('../../../util/SequelizeManager', () => {
    return {
        default: {
            instance: {
                sequelize: {
                    transaction(callback: Function) {
                        return callback(mockTransaction)
                    }
                },

                createAdvisoryLock: jest.fn(() => {
                    return Promise.resolve()
                })
            },

            getInstance() {
                return this.instance
            }
        }
    }
})

jest.mock('../../../controllers/Helpers', () => {
    return {
        getDocument: jest.fn(),
        getPanes: jest.fn(() => {
            return pane
        }),
        getPane: jest.fn(() => {
            return pane
        })
    }
})

describe('PaneController', () => {
    let controller
    beforeEach(() => {
        controller = new PaneController()
        PaneDocument.create = jest.fn()
    })

    it('should create a pane', async () => {
        Permissions.prototype.canChangeDocument = jest.fn(() => {
            return Promise.resolve(true)
        })
        const requestResponseMock = new RequestResponseMock()
        requestResponseMock.request.body = {
            documentId: '1',
            title: 'needs a title'
        }
        Pane.create = jest.fn(() => {
            return Promise.resolve(pane)
        })
        await controller.CreatePane(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseBody).toEqual({
            contents: ['some cool pane contents'],
            id: pane.id,
            revision: 1
        })
        expect(Pane.create).toHaveBeenCalled()
        expect(PaneDocument.create).toHaveBeenCalled()
    })

    it('should duplicate a pane', async () => {
        Permissions.prototype.canChangeDocument = jest.fn(() => {
            return Promise.resolve(true)
        })
        const requestResponseMock = new RequestResponseMock()
        requestResponseMock.request.body = {
            documentId: '1'
        }
        PaneDocument.create = jest.fn()
        Pane.findOne = jest.fn(() => {
            return Promise.resolve(pane)
        })
        await controller.DuplicatePane(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseBody).toEqual({
            id: 'im-a-derpricated-pane'
        })
        expect(Permissions.prototype.canChangeDocument).toHaveBeenCalled()
        expect(Pane.findOne).toHaveBeenCalled()
        expect(PaneDocument.create).toHaveBeenCalled()
    })

    it('should throw an error on duplication if a pane doesnt exist', async () => {
        Permissions.prototype.canChangeDocument = jest.fn(() => {
            return Promise.resolve(true)
        })
        const requestResponseMock = new RequestResponseMock()
        requestResponseMock.request.body = {
            documentId: '1'
        }
        Pane.findOne = jest.fn(() => {
            return Promise.resolve(null)
        })
        try {
            await controller.DuplicatePane(
                requestResponseMock.request,
                requestResponseMock.response
            )
        } catch (err) {
            expect(Permissions.prototype.canChangeDocument).toHaveBeenCalled()
            expect(Pane.findOne).toHaveBeenCalled()
            expect(PaneDocument.create).not.toHaveBeenCalled()
        }
    })

    it('should get a panes contents', async () => {
        Permissions.prototype.canViewDocument = jest.fn(() => {
            return Promise.resolve(true)
        })
        const requestResponseMock = new RequestResponseMock()
        requestResponseMock.request.body = {
            documentId: '1',
            title: 'needs a title'
        }
        await controller.GetPane(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseBody).toEqual({
            contents: ['some cool pane contents'],
            revision: 1
        })
    })

    it('should return pane revisions since a revision', async () => {
        Permissions.prototype.canViewDocument = jest.fn(() => {
            return Promise.resolve(true)
        })
        const requestResponseMock = new RequestResponseMock()
        requestResponseMock.request.body = {
            documentId: '1',
            title: 'needs a title'
        }
        requestResponseMock.request.params.revision = 10

        await controller.GetRevisionsSinceRevision(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseBody).toEqual({
            revisions: [
                {
                    createdAt: expect.anything(),
                    operation: { ops: [] },
                    revision: 15,
                    submissionId: '111-xxx-222',
                    userId: '1'
                }
            ]
        })
    })
})
