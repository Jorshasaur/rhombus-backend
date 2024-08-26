import * as sinon from 'sinon'
import * as chai from 'chai'
import { Request, Response } from 'express'
import { Permissions } from '../middleware/Permissions'
import { IndexApiService } from '../services/IndexApiService'
import { Document } from '../models/Document'
import { PERMISSION_TYPES } from '../constants/AccessSettings'
import { DocumentMembership } from '../models/DocumentMembership'

export function assertArgs(call: sinon.SinonStub, ...args: any[]) {
    chai.expect(call.args).to.deep.equals(args)
}

export function assertFirstCallArgs(call: sinon.SinonStub, ...args: any[]) {
    chai.expect(call.firstCall.args).to.deep.equals(args)
}
export function assertSecondCallArgs(call: sinon.SinonStub, ...args: any[]) {
    chai.expect(call.secondCall.args).to.deep.equals(args)
}

export function mockGetPermissionsForDocument(
    document: Document,
    actions: any
) {
    IndexApiService.prototype.GetPermissionsForDocument = jest.fn(() => {
        return {
            data: {
                [document.id]: actions
            }
        }
    })
}

export function mockGetPermissionsForSpace(spaceId: string, actions: any) {
    IndexApiService.prototype.GetPermissionsForSpace = jest.fn(() => {
        return {
            data: {
                [spaceId]: actions
            }
        }
    })
}

export function mockDocumentMembership(permissions: PERMISSION_TYPES) {
    DocumentMembership.findOne = jest.fn(() => {
        return {
            permissions
        }
    })
}

export class RequestTrackingMock {
    requestId = '123'
    requestSource = '12345'
    outgoingCallingService = 'testing'
}

export const DEFAULT_REQUEST_USER_ID = 1
export const DEFAULT_REQUEST_TEAM_ID = '1'

export class FreehandHeadersMock {
    ip = 'IP'
    userAgent = 'USER_AGENT'
    hostname = 'X_FORWARDED_HOST'
}

export const MockRequest: Request = {} as Request
MockRequest.tracing = new RequestTrackingMock()
MockRequest.route = {
    path: ''
}

const tracing = new RequestTrackingMock()
const defaultRequest = {
    invision: {
        user: {
            userId: DEFAULT_REQUEST_USER_ID,
            teamId: DEFAULT_REQUEST_TEAM_ID
        }
    },
    params: {},
    query: {},
    tracing,
    permissions: new Permissions(123, '12345', MockRequest),
    headers: {
        'user-agent': 'testing',
        'x-forwarded-host': 'testing'
    }
}

export function RequestMock(request: any = {}) {
    return Object.assign(defaultRequest, request) as Request
}

export class RequestResponseMock {
    request: Request

    responseStatusCode: number = 0
    responseBody: any
    response: Response

    constructor(request: any = {}) {
        this.response = {
            status: (code: number) => {
                this.responseStatusCode = code
                return this.response
            },
            json: (body) => {
                if (!this.responseStatusCode) {
                    this.responseStatusCode = 200
                }
                this.responseBody = body
            },
            send: (body?: any) => {
                if (!this.responseStatusCode) {
                    this.responseStatusCode = 200
                }
                this.responseBody = body
            }
        } as Response

        this.request = Object.assign({}, defaultRequest, request) as Request
    }
}
