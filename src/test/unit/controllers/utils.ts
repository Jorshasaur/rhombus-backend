import { transformDocument } from '../../../controllers/utils'
import * as Delta from 'quill-delta'

export const documentId = 'ccd533e7-d917-4601-b708-9bfea3e26f04'

export function getDocumentRecord(): any {
    const documentRecord = {
        id: documentId,
        title: 'Untitled',
        ownerId: 1,
        teamId: 'cjcjeoi2w0000rn35c23q98ou',
        isArchived: false,
        archivedAt: null,
        createdAt: '2018-03-06T12:36:53.039Z',
        updatedAt: '2018-03-06T12:36:53.094Z',
        toJSON: () => {
            return documentRecord
        },
        contents: () => {
            return {
                revision: 100,
                delta: getDocumentDelta()
            }
        }
    }
    return documentRecord
}

export function getDocumentMembershipRecord(): any {
    return {
        id: 'd02bf777-9f66-427b-b69d-539030acaea4',
        userId: 1,
        documentId,
        permissions: 0,
        isSubscribed: true
    }
}

export function getDocumentDelta() {
    return new Delta({
        ops: [
            {
                insert: 'Untitled'
            },
            {
                attributes: {
                    header: 1
                },
                insert: '\n'
            },
            {
                attributes: {
                    mark: ['cjlp3mczq00003h5p9dm45frf'],
                    author: 9
                },
                insert: 'Hello'
            },
            {
                attributes: {
                    author: 9
                },
                insert: ' World!'
            },
            {
                insert: '\nThis is a document whose text is synced in '
            },
            {
                attributes: {
                    author: 9
                },
                insert: 're'
            },
            {
                insert: 'a'
            },
            {
                attributes: {
                    author: 9
                },
                insert: 'l'
            },
            {
                insert: ' time\n'
            },
            {
                insert: {
                    'block-embed': {
                        uuid: '1704b998-5c8a-4db6-9848-a9342b3f4366',
                        service: 'file',
                        version: 1,
                        authorId: 9,
                        embedData: {
                            id: '78beb7ba-aec4-41d2-8977-dfcbfd8f4589',
                            fileName: 'test.md'
                        }
                    }
                }
            },
            {
                attributes: {
                    author: 9
                },
                insert: 'aaa'
            },
            {
                insert: '\n'
            },
            {
                attributes: {
                    author: 9
                },
                insert: 'aaaa '
            },
            {
                attributes: {
                    author: 9
                },
                insert: {
                    'document-mention': {
                        documentMention: 'true'
                    }
                }
            },
            {
                insert: '\n'
            },
            {
                attributes: {
                    author: 9
                },
                insert: 'aaa '
            },
            {
                attributes: {
                    author: 9
                },
                insert: {
                    mention: {
                        id: 9,
                        userId: 9,
                        name: 'Member V7',
                        email: 'member-v7@invisionapp.com'
                    }
                }
            },
            {
                insert: '\n'
            },
            {
                insert: {
                    'block-embed': {
                        uuid: '6900619d-b244-4772-8b5a-580f7c0d1391',
                        service: 'image',
                        version: 1,
                        authorId: 9,
                        embedData: {
                            id: '26070848-de43-4a8c-8b91-421d8240c864',
                            threadIds: ['cjn1vkzrq00013h5tdpmjse0x']
                        }
                    }
                }
            },
            {
                attributes: {
                    author: 9
                },
                insert: 'bbb'
            },
            {
                insert: '\n\n'
            }
        ]
    })
}

export function getDocumentResponse(documentRecord: any): any {
    return transformDocument(documentRecord)
}
