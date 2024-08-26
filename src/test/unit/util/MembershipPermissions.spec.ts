import {
    getMembershipPermissionsForDocuments,
    getMembershipPermissions
} from '../../../util/MembershipPermissions'
import { DocumentMembership } from '../../../models/DocumentMembership'

function getDocumentMembership() {
    return {
        documentId: '1',
        permissionsObject: () => {
            return {
                canComment: true,
                canEdit: false
            }
        }
    }
}

describe('MembershipPermissions', () => {
    it('should return permissions for given documentIds', async () => {
        DocumentMembership.findAll = jest.fn(() => {
            return [getDocumentMembership()]
        })

        const permissions = await getMembershipPermissionsForDocuments(1, [
            '1',
            '2'
        ])

        expect(permissions).toEqual({
            '1': {
                canComment: true,
                canEdit: false
            },
            '2': {
                canComment: false,
                canEdit: false
            }
        })
    })

    it('should return permissions for given documentId and user with membership', async () => {
        DocumentMembership.findOne = jest.fn(() => {
            return getDocumentMembership()
        })

        const permission = await getMembershipPermissions(1, '1')
        expect(permission).toEqual({
            canComment: true,
            canEdit: false
        })
    })

    it('should return permissions for given documentId and user without membership', async () => {
        DocumentMembership.findOne = jest.fn(() => {
            return
        })

        const permission = await getMembershipPermissions(1, '1')
        expect(permission).toEqual({
            canComment: false,
            canEdit: false
        })
    })
})
