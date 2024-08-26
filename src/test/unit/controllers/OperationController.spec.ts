import { OperationController } from '../../../controllers/OperationController'
import { DocumentRevision } from '../../../models/DocumentRevision'
import { Document } from '../../../models/Document'
import * as Delta from 'quill-delta'
import SequelizeManager from '../../../util/SequelizeManager'
import { ArchiveError } from '../../../middleware/HandleErrors'
import { RequestResponseMock } from '../../utils'
import { UniqueConstraintError, DatabaseError } from 'sequelize'
import * as promiseFinally from 'promise.prototype.finally'
import * as mockdate from 'mockdate'
import { PermissionsError } from '../../../middleware/Permissions'
import {
    Operation,
    OperationType,
    DeltaOperation,
    PaneOperation
} from '../../../interfaces/Operation'
import bugsnag from '../../../bugsnag'
import { Pane } from '../../../models/Pane'
import { PaneRevision } from '../../../models/PaneRevision'
import * as json1 from 'ot-json1'
import * as helpers from '../../../controllers/Helpers'
import SocketManager from '../../../util/SocketManager'

const mockTransaction: any = Symbol('transaction')

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

jest.mock('../../../util/SocketManager', () => {
    return {
        default: {
            instance: {
                emitOperation: jest.fn(),
                emitPaneOperation: jest.fn(),
                sendPaneUpdated: jest.fn()
            },

            getInstance() {
                return this.instance
            }
        }
    }
})

helpers.getDocumentIdsForPane = jest.fn()

function getRevision(): Operation {
    return {
        operation: {
            ops: [{ insert: 'text' }]
        },
        submissionId: '1',
        revision: 2,
        documentId: '1',
        type: OperationType.DELTA,
        revert: false
    }
}

function getContents() {
    return {
        delta: new Delta([
            { insert: 'Title\n' },
            { insert: { embed: { id: 1 } } }
        ]),
        revision: 2
    }
}

function getInvalidContents() {
    return {
        delta: new Delta([
            { insert: 'Title\n' },
            { insert: { embed: { id: 1 } } },
            { retain: 1 }
        ]),
        revision: 2
    }
}

describe('OperationController', () => {
    beforeAll(() => {
        promiseFinally.shim()
    })
    beforeEach(() => {
        Document.unscoped = jest.fn(() => {
            return Document
        })
        Document.findById = jest.fn(() => {
            return Promise.resolve({})
        })
        Pane.unscoped = jest.fn(() => {
            return Pane
        })
        Pane.findById = jest.fn(() => {
            return Promise.resolve({})
        })
    })

    it('should create instance of OperationController', () => {
        const operationController = new OperationController()
        expect(operationController).toBeInstanceOf(OperationController)
    })
    it('should issue rollback if revision is not found on PermissionsError', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        const documentId = '1'

        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId
            }
        })

        const panesRevision = { ...revision, type: OperationType.JSON1 }
        const panesRequestResponseMock = new RequestResponseMock({
            body: {
                data: panesRevision
            },
            params: {
                documentId
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: jest.fn(() => {
                throw new PermissionsError('Nope', 'test')
            })
        }

        // @ts-ignore
        panesRequestResponseMock.request.permissions = {
            canSubmitOperation: jest.fn(() => {
                throw new PermissionsError('Nope', 'test')
            })
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                id: documentId,
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    }
                    return []
                },
                getRevisionsAfterRevision() {
                    return []
                },
                contents() {
                    return getContents()
                },
                $create: jest.fn(() => {
                    return {
                        runAfterSubmitHooks: jest.fn()
                    }
                })
            })
        })

        DocumentRevision.findOne = jest.fn(() => {
            return Promise.resolve()
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve()
        })

        PaneRevision.findOne = jest.fn(() => {
            return Promise.resolve()
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )

        expect(requestResponseMock.responseStatusCode).toBe(428)
        expect(requestResponseMock.responseBody).toEqual(revision)

        await operationController.SubmitOperation(
            panesRequestResponseMock.request,
            panesRequestResponseMock.response
        )

        expect(panesRequestResponseMock.responseStatusCode).toBe(428)
        expect(panesRequestResponseMock.responseBody).toEqual(panesRevision)
    })
    it('should issue error if revision is found on PermissionsError', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        const message = 'Nope'
        const documentId = '1'
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId
            }
        })

        const panesRequestResponseMock = new RequestResponseMock({
            body: {
                data: { ...revision, type: OperationType.JSON1 }
            },
            params: {
                documentId
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: jest.fn(() => {
                throw new PermissionsError(message, 'test')
            })
        }

        // @ts-ignore
        panesRequestResponseMock.request.permissions = {
            canSubmitOperation: jest.fn(() => {
                throw new PermissionsError(message, 'test')
            })
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                id: documentId,
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    }
                    return []
                },
                getRevisionsAfterRevision() {
                    return []
                },
                contents() {
                    return getContents()
                },
                $create: jest.fn(() => {
                    return {
                        runAfterSubmitHooks: jest.fn()
                    }
                })
            })
        })

        let called = false
        DocumentRevision.findOne = jest.fn(() => {
            if (called) {
                return Promise.resolve({})
            } else {
                called = true
                return
            }
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve({
                id: documentId,
                $get(tableName: string, options: any) {
                    console.log('====', tableName)
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    }
                    return []
                },
                getRevisionsAfterRevision() {
                    return []
                },
                contents() {
                    return getContents()
                },
                $create: jest.fn(() => {
                    return {
                        runAfterSubmitHooks: jest.fn()
                    }
                })
            })
        })

        let paneCalled = false
        PaneRevision.findOne = jest.fn(() => {
            if (paneCalled) {
                return Promise.resolve({})
            } else {
                paneCalled = true
                return
            }
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )

        expect(requestResponseMock.responseStatusCode).toBe(500)
        expect(requestResponseMock.responseBody).toEqual({ message })

        await operationController.SubmitOperation(
            panesRequestResponseMock.request,
            panesRequestResponseMock.response
        )

        expect(panesRequestResponseMock.responseStatusCode).toBe(500)
        expect(panesRequestResponseMock.responseBody).toEqual({ message })
    })
    it('should issue rollback if revision is not found on DatabaseError', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })
        const paneRevision = { ...revision, type: OperationType.JSON1 }
        const panesRequestResponseMock = new RequestResponseMock({
            body: {
                data: paneRevision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        // @ts-ignore
        panesRequestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        Document.findOne = jest.fn(() => {
            const error = new Error('Database Error')
            throw new DatabaseError(error)
        })
        DocumentRevision.findOne = jest.fn(() => {
            return Promise.resolve()
        })
        Pane.findOne = jest.fn(() => {
            const error = new Error('Database Error')
            throw new DatabaseError(error)
        })
        PaneRevision.findOne = jest.fn(() => {
            return Promise.resolve()
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseStatusCode).toBe(428)
        expect(requestResponseMock.responseBody).toEqual(revision)

        await operationController.SubmitOperation(
            panesRequestResponseMock.request,
            panesRequestResponseMock.response
        )
        expect(panesRequestResponseMock.responseStatusCode).toBe(428)
        expect(panesRequestResponseMock.responseBody).toEqual(paneRevision)
    })
    it('should issue rollback if operation is not valid', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        revision.revision = -1

        const paneRevision = { ...revision, type: OperationType.JSON1 }
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })
        const panesRequestResponseMock = new RequestResponseMock({
            body: {
                data: paneRevision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        // @ts-ignore
        panesRequestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    } else {
                        return []
                    }
                }
            })
        })
        DocumentRevision.findOne = jest.fn(() => {
            return Promise.resolve()
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve({
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    } else {
                        return []
                    }
                }
            })
        })
        PaneRevision.findOne = jest.fn(() => {
            return Promise.resolve()
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseStatusCode).toBe(428)
        expect(requestResponseMock.responseBody).toEqual(revision)

        await operationController.SubmitOperation(
            panesRequestResponseMock.request,
            panesRequestResponseMock.response
        )
        expect(panesRequestResponseMock.responseStatusCode).toBe(428)
        expect(panesRequestResponseMock.responseBody).toEqual(paneRevision)
    })
    it('should log into bugsnag if operation is not composable', async () => {
        const operationController = new OperationController()

        const documentId = '1'

        const revision = getRevision()
        revision.operation = {
            ops: [{ retain: 10 }, { insert: ' ' }]
        }

        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId
            }
        })

        bugsnag.notify = jest.fn()

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                id: documentId,
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    }
                    return []
                },
                getRevisionsAfterRevision() {
                    return []
                },
                contents() {
                    return getContents()
                },
                $create: jest.fn(() => {
                    return {
                        runAfterSubmitHooks: jest.fn(),
                        getOperation: () => {
                            return revision.operation
                        }
                    }
                })
            })
        })
        let called = false
        DocumentRevision.findOne = jest.fn(() => {
            if (called) {
                return Promise.resolve({})
            } else {
                called = true
                return
            }
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseStatusCode).toBe(200)
        expect(
            bugsnag.notify
        ).toBeCalledWith(
            `Operation is not composable with document ${documentId}`,
            { severity: 'warning', operation: revision.operation }
        )
    })
    it('should log into bugsnag if document delta is already invalid', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        const documentId = '1'

        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        bugsnag.notify = jest.fn()

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                id: documentId,
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    }
                    return []
                },
                getRevisionsAfterRevision() {
                    return []
                },
                contents() {
                    return getInvalidContents()
                },
                $create: jest.fn(() => {
                    return {
                        runAfterSubmitHooks: jest.fn(),
                        getOperation: () => {
                            return revision.operation
                        }
                    }
                })
            })
        })
        let called = false
        DocumentRevision.findOne = jest.fn(() => {
            if (called) {
                return Promise.resolve({})
            } else {
                called = true
                return
            }
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(requestResponseMock.responseStatusCode).toBe(200)
        expect(bugsnag.notify).toBeCalledWith(
            `Document ${documentId} contains invalid operation`,
            {
                severity: 'warning'
            }
        )
    })
    it('should issue error if revision is found on DatabaseError', async () => {
        const operationController = new OperationController()
        const message = 'Database Error'
        const revision = getRevision()
        const paneRevision = { ...revision, type: OperationType.JSON1 }
        let documentRevisionFindCallCount = 0
        let paneRevisionFindCallCount = 0
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })
        const panesRequestResponseMock = new RequestResponseMock({
            body: {
                data: paneRevision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        // @ts-ignore
        panesRequestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        Document.findOne = jest.fn(() => {
            const error = new Error(message)
            throw new DatabaseError(error)
        })
        DocumentRevision.findOne = jest.fn(() => {
            let documentRevision
            if (documentRevisionFindCallCount > 0) {
                documentRevision = {}
            }
            documentRevisionFindCallCount++
            return Promise.resolve(documentRevision)
        })
        Pane.findOne = jest.fn(() => {
            const error = new Error(message)
            throw new DatabaseError(error)
        })
        PaneRevision.findOne = jest.fn(() => {
            let documentRevision
            if (paneRevisionFindCallCount > 0) {
                documentRevision = {}
            }
            paneRevisionFindCallCount++
            return Promise.resolve(documentRevision)
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )

        expect(requestResponseMock.responseStatusCode).toBe(500)
        expect(requestResponseMock.responseBody).toEqual({ message })

        await operationController.SubmitOperation(
            panesRequestResponseMock.request,
            panesRequestResponseMock.response
        )

        expect(panesRequestResponseMock.responseStatusCode).toBe(500)
        expect(panesRequestResponseMock.responseBody).toEqual({ message })
    })
    it('should fail if document revision issues DatabaseError', async () => {
        const operationController = new OperationController()
        const message = 'Document Revision Database Error'
        const revision = getRevision()
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        DocumentRevision.findOne = jest.fn(() => {
            const error = new Error(message)
            throw new DatabaseError(error)
        })
        try {
            await operationController.SubmitOperation(
                requestResponseMock.request,
                requestResponseMock.response
            )
        } catch (error) {
            expect(requestResponseMock.responseBody).toBeUndefined()
            expect(requestResponseMock.responseStatusCode).toBe(0)
            expect(error.message).toBe(message)
        }
    })
    it('should fail if panes revision issues DatabaseError', async () => {
        const operationController = new OperationController()
        const message = 'Panes Revision Database Error'
        const revision = { ...getRevision(), type: OperationType.JSON1 }
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        PaneRevision.findOne = jest.fn(() => {
            const error = new Error(message)
            throw new DatabaseError(error)
        })
        try {
            await operationController.SubmitOperation(
                requestResponseMock.request,
                requestResponseMock.response
            )
        } catch (error) {
            expect(requestResponseMock.responseBody).toBeUndefined()
            expect(requestResponseMock.responseStatusCode).toBe(0)
            expect(error.message).toBe(message)
        }
    })
    it('should not execute DocumentRevision runAfterSubmitHooks if there is an error in MakeDocumentRevision', async () => {
        const operationController = new OperationController()

        const revision = getRevision() as any
        revision.runAfterSubmitHooks = jest.fn()
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        Document.findOne = jest.fn(() => {
            const error = new Error('Database Error')
            throw new DatabaseError(error)
        })
        let called = false
        DocumentRevision.findOne = jest.fn(() => {
            if (called) {
                return Promise.resolve({})
            } else {
                called = true
                return
            }
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(revision.runAfterSubmitHooks).not.toHaveBeenCalled()
    })
    it('should not execute PaneRevision runAfterSubmitHooks if there is an error in MakePaneRevision', async () => {
        const operationController = new OperationController()

        const revision = {
            ...(getRevision() as any),
            type: OperationType.JSON1
        }
        revision.runAfterSubmitHooks = jest.fn()
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        Pane.findOne = jest.fn(() => {
            const error = new Error('Database Error')
            throw new DatabaseError(error)
        })
        let called = false
        PaneRevision.findOne = jest.fn(() => {
            if (called) {
                return Promise.resolve({})
            } else {
                called = true
                return
            }
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )
        expect(revision.runAfterSubmitHooks).not.toHaveBeenCalled()
    })
    it('should handle already submitted operation', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        const paneRevision = { ...revision, type: OperationType.JSON1 }

        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })
        const paneRequestResponseMock = new RequestResponseMock({
            body: {
                data: paneRevision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        // @ts-ignore
        paneRequestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        DocumentRevision.findOne = jest.fn(() => {
            return Promise.resolve({})
        })
        PaneRevision.findOne = jest.fn(() => {
            return Promise.resolve({})
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )

        expect(requestResponseMock.responseStatusCode).toBe(200)
        expect(requestResponseMock.responseBody).toEqual({})

        await operationController.SubmitOperation(
            paneRequestResponseMock.request,
            paneRequestResponseMock.response
        )

        expect(paneRequestResponseMock.responseStatusCode).toBe(200)
        expect(paneRequestResponseMock.responseBody).toEqual({})
    })
    it('should handle SequelizeUniqueConstraintError', async () => {
        const revision = getRevision()
        const paneRevision = { ...revision, type: OperationType.JSON1 }

        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })
        const paneRequestResponseMock = new RequestResponseMock({
            body: {
                data: paneRevision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        // @ts-ignore
        paneRequestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        const operationController = new OperationController()
        operationController.MakeDocumentRevision = jest.fn(() => {
            const options: any = {
                fields: {
                    submissionId: revision.submissionId
                }
            }
            throw new UniqueConstraintError(options)
        })
        operationController.MakePaneRevision = jest.fn(() => {
            const options: any = {
                fields: {
                    submissionId: paneRevision.submissionId
                }
            }
            throw new UniqueConstraintError(options)
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )

        expect(requestResponseMock.responseStatusCode).toBe(200)
        expect(requestResponseMock.responseBody).toEqual({})

        await operationController.SubmitOperation(
            paneRequestResponseMock.request,
            paneRequestResponseMock.response
        )

        expect(paneRequestResponseMock.responseStatusCode).toBe(200)
        expect(paneRequestResponseMock.responseBody).toEqual({})
    })
    it('should return error if pane does not exist', async () => {
        const operationController = new OperationController()
        const paneRevision = getRevision() as PaneOperation

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                id: paneRevision.documentId,
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    }
                    return []
                },
                getRevisionsAfterRevision() {
                    return []
                },
                contents() {
                    return getInvalidContents()
                },
                $create: jest.fn(() => {
                    return {
                        runAfterSubmitHooks: jest.fn(),
                        getOperation: () => {
                            return revision.operation
                        }
                    }
                })
            })
        })
        Pane.findOne = jest.fn(() => {
            return Promise.resolve()
        })
        const permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        await expect(
            operationController.MakePaneRevision(
                1,
                '2',
                paneRevision,
                mockTransaction,
                permissions as any
            )
        ).rejects.toThrow('Rejecting Operation because the Pane is undefined')
    })
    it('should return error if document does not exist', async () => {
        const operationController = new OperationController()

        const revision = getRevision() as DeltaOperation
        const paneRevision = getRevision() as PaneOperation

        Document.findOne = jest.fn(() => {
            return Promise.resolve()
        })
        Pane.findOne = jest.fn(() => {
            return Promise.resolve()
        })

        await expect(
            operationController.MakeDocumentRevision(
                1,
                '2',
                revision,
                mockTransaction
            )
        ).rejects.toThrow(
            'Rejecting Operation because the Document is undefined'
        )

        await expect(
            operationController.MakePaneRevision(
                1,
                '2',
                paneRevision,
                mockTransaction
            )
        ).rejects.toThrow(
            'Rejecting Operation because the Document is undefined'
        )
    })
    it('should return error if incomingRevision is null, 0, <0', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        revision.revision = -1
        const paneRevision = { ...revision, type: OperationType.JSON1 }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    } else {
                        return []
                    }
                }
            })
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve({
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    } else {
                        return []
                    }
                }
            })
        })

        const permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        await expect(
            operationController.MakeDocumentRevision(
                1,
                '2',
                revision,
                mockTransaction
            )
        ).rejects.toThrow('Incoming revision is -1 and must be valid and gte 0')

        await expect(
            operationController.MakePaneRevision(
                1,
                '2',
                paneRevision,
                mockTransaction,
                permissions
            )
        ).rejects.toThrow('Incoming revision is -1 and must be valid and gte 0')
    })
    it('should return error if incomingRevision is more then one revision ahead', async () => {
        const operationController = new OperationController()

        const revision = getRevision()
        revision.revision = 3
        const paneRevision = { ...revision, type: OperationType.JSON1 }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    } else {
                        return []
                    }
                }
            })
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve({
                $get(tableName: string, options: any) {
                    if (tableName === 'revisions' && options.limit === 1) {
                        const lastRevision = getRevision()
                        lastRevision.revision = 1
                        return [lastRevision]
                    } else {
                        return []
                    }
                }
            })
        })

        const permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }
        await expect(
            operationController.MakeDocumentRevision(
                1,
                '2',
                revision,
                mockTransaction
            )
        ).rejects.toThrow(
            'Incoming revision (3) is more than 1 revision ahead of previous revision (1)'
        )

        await expect(
            operationController.MakePaneRevision(
                1,
                '2',
                revision,
                mockTransaction,
                permissions
            )
        ).rejects.toThrow(
            'Incoming revision (3) is more than 1 revision ahead of previous revision (1)'
        )
    })
    it('should make the operation', async () => {
        const operationController = new OperationController()
        mockdate.set('2018-12-12')
        const revision = getRevision() as DeltaOperation
        const userId = 1
        const doc = {
            $get(tableName: string, options: any) {
                if (tableName === 'revisions' && options.limit === 1) {
                    const lastRevision = getRevision()
                    lastRevision.revision = 1
                    return [lastRevision]
                }
                return []
            },
            contents() {
                return getContents()
            },
            getRevisionsAfterRevision() {
                return []
            },
            $create: jest.fn((tableName: string, values: any) => {
                return values
            })
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve(doc)
        })

        const requestResponseMock = new RequestResponseMock({})

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        const operation = await operationController.MakeDocumentRevision(
            userId,
            '2',
            revision,
            mockTransaction,
            // @ts-ignore
            requestResponseMock.request.permissions
        )

        expect(operation).toEqual({
            revision: revision.revision,
            delta: new Delta(revision.operation),
            submissionId: revision.submissionId,
            userId,
            sentAt: new Date(),
            revert: false
        })

        const firstCall = doc.$create.mock.calls[0]
        const secondParameter = firstCall[1]

        expect(firstCall[0]).toEqual('revision')
        expect(secondParameter.revision).toEqual(revision.revision)
        expect(secondParameter.delta).toEqual(new Delta(revision.operation))
        expect(secondParameter.submissionId).toEqual(revision.submissionId)
        expect(secondParameter.userId).toEqual(userId)
        expect(secondParameter.sentAt).toBeInstanceOf(Date)
        mockdate.reset()
    })
    it('should make the panes operation', async () => {
        const operationController = new OperationController()
        const original = {
            name: 'test',
            id: '12345'
        }
        mockdate.set('2018-12-12')
        const newOp = [
            json1.replaceOp(['name'], 'test', 'Captain Planet'),
            json1.replaceOp(['id'], '12345', 'aabbcc')
        ].reduce(json1.type.compose, null)
        const revision = {
            ...getRevision(),
            type: OperationType.JSON1,
            paneId: '1',
            operation: { ops: newOp }
        } as PaneOperation
        const userId = 1
        const pane = {
            $get(tableName: string, options: any) {
                if (tableName === 'revisions' && options.limit === 1) {
                    const lastRevision = getRevision()
                    lastRevision.revision = 1
                    lastRevision.operation = newOp
                    return [lastRevision]
                }
                return []
            },
            contents() {
                return { contents: original }
            },
            getRevisionsAfterRevision() {
                return []
            },
            $create: jest.fn((tableName: string, values: any) => {
                return values
            })
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({})
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve(pane)
        })

        const requestResponseMock = new RequestResponseMock({})

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        const operation = await operationController.MakePaneRevision(
            userId,
            '2',
            revision,
            mockTransaction,
            // @ts-ignore
            requestResponseMock.request.permissions
        )

        const transformed = [
            ['id', { i: 'aabbcc', r: '12345' }],
            ['name', { i: 'Captain Planet', r: 'test' }]
        ]
        expect(operation).toEqual({
            revision: revision.revision,
            operation: transformed,
            submissionId: revision.submissionId,
            userId,
            teamId: '2',
            revert: false
        })

        const firstCall = pane.$create.mock.calls[0]
        const secondParameter = firstCall[1]

        expect(firstCall[0]).toEqual('revision')
        expect(secondParameter.revision).toEqual(revision.revision)
        expect(secondParameter.operation).toEqual(transformed)
        expect(secondParameter.submissionId).toEqual(revision.submissionId)
        expect(secondParameter.userId).toEqual(userId)
        mockdate.reset()
    })
    it('should make the panes operation with delta ops', async () => {
        const operationController = new OperationController()
        const original = {
            name: 'test',
            id: '12345'
        }
        mockdate.set('2018-12-12')
        const newOp = [
            json1.replaceOp(['id'], '12345', 'aabbcc'),
            json1.editOp(
                ['name'],
                'rich-text',
                new Delta().insert('Im Delta Text!')
            )
        ].reduce(json1.type.compose, null)
        const revision = {
            ...getRevision(),
            type: OperationType.JSON1,
            paneId: '1',
            operation: { ops: newOp }
        } as PaneOperation
        const userId = 1
        const pane = {
            $get(tableName: string, options: any) {
                if (tableName === 'revisions' && options.limit === 1) {
                    const lastRevision = getRevision()
                    lastRevision.revision = 1
                    lastRevision.operation = newOp
                    return [lastRevision]
                }
                return []
            },
            contents() {
                return { contents: original }
            },
            getRevisionsAfterRevision() {
                return []
            },
            $create: jest.fn((tableName: string, values: any) => {
                return values
            })
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve({})
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve(pane)
        })

        const requestResponseMock = new RequestResponseMock({})

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        const operation = await operationController.MakePaneRevision(
            userId,
            '2',
            revision,
            mockTransaction,
            // @ts-ignore
            requestResponseMock.request.permissions
        )

        const transformed = [
            ['id', { i: 'aabbcc', r: '12345' }],
            [
                'name',
                { et: 'rich-text', e: { ops: [{ insert: 'Im Delta Text!' }] } }
            ]
        ]
        expect(operation).toEqual({
            revision: revision.revision,
            operation: transformed,
            submissionId: revision.submissionId,
            userId,
            teamId: '2',
            revert: false
        })

        const firstCall = pane.$create.mock.calls[0]
        const secondParameter = firstCall[1]

        expect(firstCall[0]).toEqual('revision')
        expect(secondParameter.revision).toEqual(revision.revision)
        expect(secondParameter.operation).toEqual(transformed)
        expect(secondParameter.submissionId).toEqual(revision.submissionId)
        expect(secondParameter.userId).toEqual(userId)
        mockdate.reset()
    })
    it('should submit the delta operation', async () => {
        const operationController = new OperationController()
        const revision = getRevision()
        const runAfterSubmitHooksMock = jest.fn()
        const doc = {
            $get(tableName: string, options: any) {
                if (tableName === 'revisions' && options.limit === 1) {
                    const lastRevision = getRevision()
                    lastRevision.revision = 1
                    return [lastRevision]
                }
                return []
            },
            getRevisionsAfterRevision() {
                return []
            },
            contents() {
                return getContents()
            },
            $create: jest.fn((tableName: string, values: any) => {
                return {
                    ...values,
                    runAfterSubmitHooks: runAfterSubmitHooksMock,
                    getOperation: () => {
                        return revision.operation
                    }
                }
            })
        }

        Document.findOne = jest.fn(() => {
            return Promise.resolve(doc)
        })
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        let called = false
        DocumentRevision.findOne = jest.fn(() => {
            if (called) {
                return Promise.resolve({})
            } else {
                called = true
                return
            }
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )

        const sequelizeManager = SequelizeManager.getInstance()

        expect(sequelizeManager.createAdvisoryLock).toBeCalledWith(
            `document-${revision.documentId}`,
            mockTransaction
        )

        expect(requestResponseMock.responseStatusCode).toBe(200)
        expect(requestResponseMock.responseBody).toEqual({
            documentId: revision.documentId,
            operation: revision.operation,
            revision: revision.revision,
            submissionId: revision.submissionId,
            type: revision.type,
            revert: revision.revert
        })
        expect(SocketManager.getInstance().emitOperation).toHaveBeenCalled()
    })
    it('should submit the pane operation', async () => {
        const operationController = new OperationController()
        const original = {
            name: 'test',
            id: '12345'
        }
        mockdate.set('2018-12-12')
        const newOp = [
            json1.replaceOp(['name'], 'test', 'Captain Planet'),
            json1.replaceOp(['id'], '12345', 'aabbcc')
        ].reduce(json1.type.compose, null)
        const revision = {
            ...getRevision(),
            type: OperationType.JSON1,
            paneId: '1',
            operation: { ops: newOp }
        } as PaneOperation
        const runAfterSubmitHooksMock = jest.fn()
        const doc = {
            $get(tableName: string, options: any) {
                if (tableName === 'revisions' && options.limit === 1) {
                    const lastRevision = getRevision()
                    lastRevision.revision = 1
                    return [lastRevision]
                }
                return []
            },
            getRevisionsAfterRevision() {
                return []
            },
            contents() {
                return { contents: original }
            },
            $create: jest.fn((tableName: string, values: any) => {
                return {
                    ...values,
                    runAfterSubmitHooks: runAfterSubmitHooksMock,
                    getOperation: () => {
                        return revision.operation
                    }
                }
            })
        }
        Document.findOne = jest.fn(() => {
            return Promise.resolve({})
        })
        Pane.findOne = jest.fn(() => {
            return Promise.resolve(doc)
        })
        const requestResponseMock = new RequestResponseMock({
            body: {
                data: revision
            },
            params: {
                documentId: '1'
            }
        })

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        let called = false
        PaneRevision.findOne = jest.fn(() => {
            if (called) {
                return Promise.resolve({})
            } else {
                called = true
                return
            }
        })

        await operationController.SubmitOperation(
            requestResponseMock.request,
            requestResponseMock.response
        )

        const sequelizeManager = SequelizeManager.getInstance()

        expect(sequelizeManager.createAdvisoryLock).toBeCalledWith(
            `pane-${revision.paneId}`,
            mockTransaction
        )

        expect(requestResponseMock.responseStatusCode).toBe(200)
        expect(requestResponseMock.responseBody).toEqual({
            documentId: revision.documentId,
            operation: revision.operation,
            revision: revision.revision,
            submissionId: revision.submissionId,
            type: revision.type,
            revert: revision.revert,
            paneId: revision.paneId
        })
        expect(SocketManager.getInstance().sendPaneUpdated).toHaveBeenCalled()
    })
    it('should return an error if the document is archived', async () => {
        const operationController = new OperationController()
        const revision = getRevision()
        const paneRevision = {
            ...getRevision(),
            type: OperationType.JSON1,
            paneId: '1',
            operation: { ops: [] }
        } as PaneOperation
        const doc = {
            isArchived: true
        }
        Document.findDocument = jest.fn(() => {
            return Promise.resolve(doc)
        })

        expect(
            operationController.MakeDocumentRevision(
                1,
                '2',
                revision as DeltaOperation,
                mockTransaction,
                null
            )
        ).rejects.toThrow(ArchiveError.MESSAGE)

        expect(
            operationController.MakePaneRevision(
                1,
                '2',
                paneRevision,
                mockTransaction,
                null
            )
        ).rejects.toThrow(ArchiveError.MESSAGE)
    })
    it('should merge concurrent pane revisions', async () => {
        const operationController = new OperationController()
        const original = {
            name: 'test',
            id: '12345',
            viewType: 'blah'
        }
        mockdate.set('2018-12-12')

        const newOp = [
            json1.replaceOp(['name'], 'test', 'Captain Planet'),
            json1.replaceOp(['id'], '12345', 'aabbcc'),
            json1.replaceOp(['viewType'], 'blah', 'someViewType')
        ].reduce(json1.type.compose, null)

        const revision = {
            ...getRevision(),
            type: OperationType.JSON1,
            paneId: '1',
            operation: { ops: newOp }
        } as PaneOperation

        const userId = 1
        const pane = {
            $get(tableName: string, options: any) {
                if (tableName === 'revisions' && options.limit === 1) {
                    const lastRevision = getRevision()
                    lastRevision.revision = 1
                    lastRevision.operation = newOp
                    return [lastRevision]
                }
                return []
            },
            contents() {
                return { contents: original }
            },
            getRevisionsAfterRevision() {
                return [
                    {
                        operation: json1.replaceOp(
                            ['name'],
                            'test',
                            'Captain America'
                        )
                    },
                    {
                        operation: json1.removeOp(['viewType'])
                    }
                ]
            },
            $create: jest.fn((tableName: string, values: any) => {
                return values
            })
        }

        operationController.getDocumentForRevisions = jest.fn()

        Document.findOne = jest.fn(() => {
            return Promise.resolve({})
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve(pane)
        })

        const requestResponseMock = new RequestResponseMock({})

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        const operation = await operationController.MakePaneRevision(
            userId,
            '2',
            revision,
            mockTransaction,
            // @ts-ignore
            requestResponseMock.request.permissions
        )
        const transformed = [
            ['id', { r: true, i: 'aabbcc' }],
            ['name', { r: true, i: 'Captain Planet' }],
            ['viewType', { i: 'someViewType' }]
        ]

        expect(operation).toEqual({
            revision: revision.revision,
            operation: transformed,
            submissionId: revision.submissionId,
            userId,
            teamId: '2',
            revert: false
        })

        const firstCall = pane.$create.mock.calls[0]
        const secondParameter = firstCall[1]

        expect(firstCall[0]).toEqual('revision')
        expect(secondParameter.revision).toEqual(revision.revision)
        expect(secondParameter.operation).toEqual(transformed)
        expect(secondParameter.submissionId).toEqual(revision.submissionId)
        expect(secondParameter.userId).toEqual(userId)
        mockdate.reset()
    })
    it('should reach eventual consistency while merging concurrent pane revisions', async () => {
        const operationController = new OperationController()
        const original = {
            name: 'test',
            id: '12345',
            viewType: 'blah'
        }
        mockdate.set('2018-12-12')

        const newOp = [
            json1.replaceOp(['name'], 'test', 'Captain Planet'),
            json1.replaceOp(['id'], '12345', 'aabbcc'),
            json1.replaceOp(['viewType'], 'blah', 'someViewType')
        ].reduce(json1.type.compose, null)

        const oldOp = json1.replaceOp(['name'], 'test', 'Captain America')

        const revision = {
            ...getRevision(),
            type: OperationType.JSON1,
            paneId: '1',
            operation: { ops: newOp }
        } as PaneOperation

        const userId = 1
        const pane = {
            $get(tableName: string, options: any) {
                if (tableName === 'revisions' && options.limit === 1) {
                    const lastRevision = getRevision()
                    lastRevision.revision = 1
                    lastRevision.operation = newOp
                    return [lastRevision]
                }
                return []
            },
            contents() {
                return { contents: original }
            },
            getRevisionsAfterRevision() {
                return [
                    {
                        operation: oldOp
                    }
                ]
            },
            $create: jest.fn((tableName: string, values: any) => {
                return values
            })
        }

        operationController.getDocumentForRevisions = jest.fn()

        Document.findOne = jest.fn(() => {
            return Promise.resolve({})
        })

        Pane.findOne = jest.fn(() => {
            return Promise.resolve(pane)
        })

        const requestResponseMock = new RequestResponseMock({})

        // @ts-ignore
        requestResponseMock.request.permissions = {
            canSubmitOperation: () => Promise.resolve(true)
        }

        const operation = await operationController.MakePaneRevision(
            userId,
            '2',
            revision,
            mockTransaction,
            // @ts-ignore
            requestResponseMock.request.permissions
        )
        const client = json1.type.transformNoConflict(newOp, oldOp, 'left')
        const clientDoc = json1.type.apply(original, client)

        const serverDoc = json1.type.apply(original, operation.operation)
        expect(serverDoc).toEqual(clientDoc)

        mockdate.reset()
    })
})

describe('JSON1 Operations', () => {
    let initialDocState = {
        name: '',
        viewType: '',
        id: '',
        elements: []
    }
    let doc
    const revision1 = [
        ['name', { i: 'Revision1', r: true }],
        ['id', { i: 'aabbcc', r: true }]
    ].reduce(json1.type.compose, null)
    const revision2 = [
        ['name', { i: 'Revision2', r: true }],
        ['id', { i: 'bbcc', r: true }]
    ].reduce(json1.type.compose, null)
    const revision3 = [
        ['name', { i: 'Revision3', r: true }],
        ['elements', 0, { i: 'hello' }]
    ].reduce(json1.type.compose, null)
    const revision4 = [
        ['name', { i: 'Revision4', r: true }],
        ['id', { i: 'newId', r: true }]
    ].reduce(json1.type.compose, null)
    const revision5 = [
        ['name', { i: 'Revision5', r: true }],
        ['elements', 0, { i: 'listItem', r: true }]
    ].reduce(json1.type.compose, null)
    const revision6 = [
        ['name', { i: 'Revision6', r: true }],
        ['elements', 0, { i: 'revision6change', r: true }]
    ].reduce(json1.type.compose, null)
    const revision7 = [
        ['name', { i: 'Revision7', r: true }],
        ['elements', 0, { r: true }]
    ].reduce(json1.type.compose, null)

    beforeEach(() => {
        doc = json1.type.create(initialDocState)
    })

    it('should reach eventual consistency between a client and server', () => {
        const client = json1.type.transformNoConflict(
            revision2,
            revision1,
            'left'
        )
        let clientDoc = json1.type.create(initialDocState)
        clientDoc = json1.type.apply(clientDoc, client)

        const revisions = [revision1]
        let server = revision2
        revisions.forEach((op) => {
            server = json1.type.transformNoConflict(server, op, 'left')
        })
        let serverDoc = json1.type.create(initialDocState)
        serverDoc = json1.type.apply(serverDoc, server)

        expect(clientDoc).toEqual(serverDoc)
    })
    it('should reach eventual consistency between a client and server that has list inserts', () => {
        const client = json1.type.transformNoConflict(
            revision4,
            revision3,
            'left'
        )
        let clientDoc = json1.type.create(initialDocState)
        clientDoc = json1.type.apply(clientDoc, client)

        const revisions = [revision3]
        let server = revision4
        revisions.forEach((op) => {
            server = json1.type.transformNoConflict(server, op, 'left')
        })
        let serverDoc = json1.type.create(initialDocState)
        serverDoc = json1.type.apply(serverDoc, server)

        expect(clientDoc).toEqual(serverDoc)
    })
    it('should reach eventual consistency between a client and server that has list changes', () => {
        const client = json1.type.transformNoConflict(
            revision6,
            revision5,
            'left'
        )
        let clientDoc = json1.type.create(initialDocState)
        clientDoc = json1.type.apply(clientDoc, client)

        const revisions = [revision5]
        let server = revision6
        revisions.forEach((op) => {
            server = json1.type.transformNoConflict(server, op, 'left')
        })
        let serverDoc = json1.type.create(initialDocState)
        serverDoc = json1.type.apply(serverDoc, server)

        expect(clientDoc).toEqual(serverDoc)
    })
    it('should reach eventual consistency between a client and server that has list deletes', () => {
        const client = json1.type.transformNoConflict(
            revision7,
            revision6,
            'left'
        )
        let clientDoc = json1.type.create(initialDocState)
        clientDoc = json1.type.apply(clientDoc, client)

        const revisions = [revision6]
        let server = revision7
        revisions.forEach((op) => {
            server = json1.type.transformNoConflict(server, op, 'left')
        })
        let serverDoc = json1.type.create(initialDocState)
        serverDoc = json1.type.apply(serverDoc, server)

        expect(clientDoc).toEqual(serverDoc)
    })
    /** 
     * This currently breaks with the message: "Trying to overwrite value at key. Your op needs to remove it first"
     * I think this is because the transform can't manage an insert on a deleted field correctly.
    it('should reach consistency with deleted fields', () => {
        // Hand coded ops or an op made from the api yields the same result
        // const serverOp = ['name', { r: true }]
        // const clientOp = ['name', { i: 'This will break', r: true }]
        
        const serverOp = json1.removeOp(['name'])
        const clientOp = json1.insertOp(['name'], 'This will break')

        // The problem is that the output of this transform is
        // [ 'name', { i: 'This will break' } ] and not [ 'name', { i: 'This will break', r: true } ]
        const client = json1.type.transformNoConflict(
            clientOp,
            serverOp,
            'left'
        )
        
        let clientDoc = json1.type.create(initialDocState)
        clientDoc = json1.type.apply(clientDoc, client)

        const revisions = [ serverOp ]
        let incomingClientOp = clientOp
        revisions.forEach((existingServerOps) => {
            incomingClientOp = json1.type.transformNoConflict(incomingClientOp, existingServerOps, 'left')
        })
        let serverDoc = json1.type.create(initialDocState)
        serverDoc = json1.type.apply(serverDoc, incomingClientOp)

        expect(clientDoc).toEqual(serverDoc)
    })
    */
})
