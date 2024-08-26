import {
    getSurroundingDelta,
    getPaneSurroundingDelta
} from '../../../util/SurroundingDelta'
import * as Delta from 'quill-delta'
import { CustomEmbeds } from '../../../interfaces/CustomEmbeds'

const documentOps1 = [
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
        insert: 'This is a document whose text is synced in real time'
    },
    {
        attributes: {
            author: '9',
            header: 2
        },
        insert: '\n'
    },
    {
        attributes: {
            author: '9'
        },
        insert: 'Line with mention '
    },
    {
        attributes: {
            author: '9'
        },
        insert: {
            mention: {
                id: '1234',
                name: 'Test user'
            }
        }
    },
    {
        attributes: {
            author: '9'
        },
        insert: '\n'
    },
    {
        attributes: {
            author: '9'
        },
        insert: 'Another line'
    },
    {
        attributes: {
            author: '9',
            list: true
        },
        insert: '\n'
    }
]

const mentionOps1 = [
    {
        retain: 80
    },
    {
        attributes: {
            author: '9'
        },
        insert: {
            mention: {
                id: '1234',
                name: 'Test user'
            }
        }
    }
]

const documentOps2 = [
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
        insert: 'This is a document whose text is synced in real time'
    },
    {
        attributes: {
            author: '9'
        },
        insert: '\n\n'
    },
    {
        attributes: {
            author: '9'
        },
        insert: {
            mention: {
                email: 'admin@invisionapp.com',
                id: '1',
                name: 'Admin User'
            }
        }
    },
    {
        insert: '\n'
    }
]

const mentionOps2 = [
    {
        retain: 63
    },
    {
        attributes: {
            author: '9'
        },
        insert: {
            mention: {
                email: 'admin@invisionapp.com',
                id: '1',
                name: 'Admin User'
            }
        }
    }
]

describe('SurroundingDelta', () => {
    describe('getSurroundingDelta', () => {
        it('should get surrounding delta', () => {
            const documentDelta = new Delta(documentOps1)

            const retainOp = mentionOps1[0] as any

            const res = getSurroundingDelta(documentDelta, retainOp.retain)
            expect(res).toEqual(
                new Delta([
                    {
                        insert:
                            'This is a document whose text is synced in real time'
                    },
                    {
                        insert: '\n',
                        attributes: {
                            author: '9',
                            header: 2
                        }
                    },
                    {
                        attributes: {
                            author: '9'
                        },
                        insert: 'Line with mention '
                    },
                    {
                        attributes: {
                            author: '9'
                        },
                        insert: {
                            mention: {
                                id: '1234',
                                name: 'Test user'
                            }
                        }
                    },
                    {
                        insert: '\nAnother line',
                        attributes: {
                            author: '9'
                        }
                    },
                    {
                        insert: '\n',
                        attributes: {
                            author: '9',
                            list: true
                        }
                    }
                ])
            )
        })

        it('should get surrounding delta for multiple \n\n', () => {
            const documentDelta = new Delta(documentOps2)

            const retainOp = mentionOps2[0] as any

            const res = getSurroundingDelta(documentDelta, retainOp.retain)
            expect(res).toEqual(
                new Delta([
                    {
                        insert: '\n',
                        attributes: {
                            author: '9'
                        }
                    },
                    {
                        attributes: {
                            author: '9'
                        },
                        insert: {
                            mention: {
                                email: 'admin@invisionapp.com',
                                id: '1',
                                name: 'Admin User'
                            }
                        }
                    },
                    {
                        insert: '\n'
                    }
                ])
            )
        })
    })

    describe('getPaneSurroundingDelta', () => {
        it('should get pane surrounding delta', () => {
            const paneId = '1'
            const delta = new Delta()
                .insert('Hello\n', { header: 1 })
                .insert({
                    [CustomEmbeds.PaneEmbed]: { embedData: { pane: paneId } }
                })
                .insert({ [CustomEmbeds.BlockEmbed]: { block: true } })
                .insert('World!\n')

            const res = getPaneSurroundingDelta(delta, paneId)
            expect(res).toEqual(
                new Delta()
                    .insert('Hello\n', { header: 1 })
                    .insert({
                        [CustomEmbeds.PaneEmbed]: {
                            embedData: { pane: paneId }
                        }
                    })
                    .insert({ [CustomEmbeds.BlockEmbed]: { block: true } })
            )
        })

        it('should get surrounding delta when pane is in first line', () => {
            const paneId = '1'
            const delta = new Delta()
                .insert({
                    [CustomEmbeds.PaneEmbed]: { embedData: { pane: paneId } }
                })
                .insert('World!\n')

            const res = getPaneSurroundingDelta(delta, paneId)
            expect(res).toEqual(
                new Delta()
                    .insert({
                        [CustomEmbeds.PaneEmbed]: {
                            embedData: { pane: paneId }
                        }
                    })
                    .insert('World!\n')
            )
        })

        it('should get surrounding delta when pane is in last line', () => {
            const paneId = '1'
            const delta = new Delta().insert('Hello\n', { header: 1 }).insert({
                [CustomEmbeds.PaneEmbed]: { embedData: { pane: paneId } }
            })

            const res = getPaneSurroundingDelta(delta, paneId)
            expect(res).toEqual(
                new Delta().insert('Hello\n', { header: 1 }).insert({
                    [CustomEmbeds.PaneEmbed]: {
                        embedData: { pane: paneId }
                    }
                })
            )
        })
    })
})
