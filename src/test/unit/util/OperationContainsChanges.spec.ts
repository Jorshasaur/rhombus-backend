import * as Delta from 'quill-delta'
import {
    operationContainsChanges,
    operationContainsOnlyCommentChange
} from '../../../util/OperationContainsChanges'

describe('operationContainsChanges', () => {
    it('returns true if there are any inserts or deletes in the operation', () => {
        const insertOps = [{ insert: 'foo' }, { retain: 76 }]
        const deleteOps = [{ retain: 35 }, { delete: 1 }]

        expect(operationContainsChanges(insertOps)).toBe(true)
        expect(operationContainsChanges(deleteOps)).toBe(true)
    })

    it('returns false for a comment operation', () => {
        const commentOps = [{ retain: 35, attributes: {} }]

        expect(operationContainsChanges(commentOps)).toBe(false)
    })
})

describe('operationContainsOnlyCommentChange', () => {
    it('should return false if operation is not allowed', () => {
        let submittedDelta = new Delta([
            {
                retain: 1285
            },
            {
                delete: 1
            }
        ])

        let documentDelta = new Delta([
            {
                insert: 'Title\n'
            }
        ])

        expect(
            operationContainsOnlyCommentChange(documentDelta, submittedDelta)
        ).toBe(false)

        submittedDelta = new Delta([
            {
                retain: 1285
            },
            {
                insert: {
                    'block-embed': {
                        version: 1,
                        originalLink:
                            'https://work.invisionapp.com/freehand/Freehand-Embed--8VFmb61nW',
                        type: 'iframe',
                        service: 'freehand',
                        uuid: '0bc19f71-3728-4936-b2d0-e8875d37f796',
                        authorId: 147071656,
                        embedData: {
                            id: 6137988,
                            threadIds: ['cju8vtihe00013g5rjeu12kzg']
                        },
                        createdAt: '2019-04-03T19:37:59.654Z',
                        size: 'large'
                    }
                },
                attributes: {
                    author: 293115068
                }
            },
            {
                delete: 1
            }
        ])

        expect(
            operationContainsOnlyCommentChange(documentDelta, submittedDelta)
        ).toBe(false)

        documentDelta = new Delta([
            {
                insert: 'Title\n'
            },
            {
                insert: {
                    'block-embed': {
                        version: 1,
                        originalLink:
                            'https://work.invisionapp.com/freehand/Freehand-Embed--8VFmb61nW',
                        type: 'iframe',
                        service: 'freehand',
                        uuid: '0bc19f71-3728-4936-b2d0-e8875d37f796',
                        authorId: 147071656,
                        embedData: {
                            id: 6137988
                        },
                        createdAt: '2019-04-03T19:37:59.654Z',
                        size: 'small'
                    }
                },
                attributes: {
                    author: 293115068
                }
            }
        ])

        expect(
            operationContainsOnlyCommentChange(documentDelta, submittedDelta)
        ).toBe(false)
    })

    it('should return true if only thread was added in the operation', () => {
        let submittedDelta = new Delta([
            {
                retain: 1285
            },
            {
                insert: {
                    'block-embed': {
                        version: 1,
                        originalLink:
                            'https://work.invisionapp.com/freehand/Freehand-Embed--8VFmb61nW',
                        type: 'iframe',
                        service: 'freehand',
                        uuid: '0bc19f71-3728-4936-b2d0-e8875d37f796',
                        authorId: 147071656,
                        embedData: {
                            id: 6137988,
                            threadIds: ['cju8vtihe00013g5rjeu12kzg']
                        },
                        createdAt: '2019-04-03T19:37:59.654Z',
                        size: 'large'
                    }
                },
                attributes: {
                    author: 293115068
                }
            },
            {
                delete: 1
            }
        ])

        let documentDelta = new Delta([
            {
                insert: 'Title\n'
            },
            {
                insert: 'Some text\n'
            },
            {
                insert: {
                    'block-embed': {
                        version: 1,
                        originalLink:
                            'https://work.invisionapp.com/freehand/Freehand-Embed--8VFmb61nW',
                        type: 'iframe',
                        service: 'freehand',
                        uuid: '0bc19f71-3728-4936-b2d0-e8875d37f796',
                        authorId: 147071656,
                        embedData: {
                            id: 6137988
                        },
                        createdAt: '2019-04-03T19:37:59.654Z',
                        size: 'large'
                    }
                },
                attributes: {
                    author: 293115068
                }
            },
            {
                insert: 'Some text\n'
            }
        ])

        expect(
            operationContainsOnlyCommentChange(documentDelta, submittedDelta)
        ).toBe(true)

        documentDelta = new Delta([
            {
                insert: 'Title\n'
            },
            {
                insert: {
                    'block-embed': {
                        version: 1,
                        originalLink:
                            'https://work.invisionapp.com/freehand/Freehand-Embed--8VFmb61nW',
                        type: 'iframe',
                        service: 'freehand',
                        uuid: '0bc19f71-3728-4936-b2d0-e8875d37f796',
                        authorId: 147071656,
                        embedData: {
                            id: 6137988,
                            threadIds: []
                        },
                        createdAt: '2019-04-03T19:37:59.654Z',
                        size: 'large'
                    }
                },
                attributes: {
                    author: 293115068
                }
            }
        ])

        expect(
            operationContainsOnlyCommentChange(documentDelta, submittedDelta)
        ).toBe(true)

        documentDelta = new Delta([
            {
                insert: 'Title\n'
            },
            {
                insert: {
                    'block-embed': {
                        version: 1,
                        originalLink:
                            'https://work.invisionapp.com/freehand/Freehand-Embed--8VFmb61nW',
                        type: 'iframe',
                        service: 'freehand',
                        uuid: '0bc19f71-3728-4936-b2d0-e8875d37f796',
                        authorId: 147071656,
                        embedData: {
                            id: 6137988,
                            threadIds: ['cjuve2kw50000jtcdrhahigbb']
                        },
                        createdAt: '2019-04-03T19:37:59.654Z',
                        size: 'large'
                    }
                },
                attributes: {
                    author: 293115068
                }
            }
        ])

        submittedDelta = new Delta([
            {
                retain: 1285
            },
            {
                insert: {
                    'block-embed': {
                        version: 1,
                        originalLink:
                            'https://work.invisionapp.com/freehand/Freehand-Embed--8VFmb61nW',
                        type: 'iframe',
                        service: 'freehand',
                        uuid: '0bc19f71-3728-4936-b2d0-e8875d37f796',
                        authorId: 147071656,
                        embedData: {
                            id: 6137988,
                            threadIds: [
                                'cjuve2kw50000jtcdrhahigbb',
                                'cju8vtihe00013g5rjeu12kzg'
                            ]
                        },
                        createdAt: '2019-04-03T19:37:59.654Z',
                        size: 'large'
                    }
                },
                attributes: {
                    author: 293115068
                }
            },
            {
                delete: 1
            }
        ])

        expect(
            operationContainsOnlyCommentChange(documentDelta, submittedDelta)
        ).toBe(true)
    })
})
