import diff from '../../../util/DeltaDiff'
import * as Delta from 'quill-delta'
import { CustomEmbeds } from '../../../interfaces/CustomEmbeds'

function test(
    previousDelta: Delta,
    currentDelta: Delta,
    expectedResult: { ops: Delta.DeltaOperation[] }
) {
    const diffRes = diff(previousDelta, currentDelta)
    expect(diffRes).toEqual(expectedResult)
}

describe('DeltaDiff', () => {
    it('should diff two strings', () => {
        test(new Delta().insert('Tomas'), new Delta().insert('Tomas test'), {
            ops: [
                {
                    retain: 5
                },
                {
                    insert: ' test'
                }
            ]
        })

        test(
            new Delta().insert('Lorem ipsum'),
            new Delta().insert('Dolor Sit Amet'),
            {
                ops: [
                    { insert: 'Dolor' },
                    { delete: 5 },
                    { retain: 1 },
                    { insert: 'Sit Amet' },
                    { delete: 5 }
                ]
            }
        )

        test(
            new Delta().insert('Writing some text\nSit Amet'),
            new Delta().insert(
                'Writing some text\nOmg Writing some text\nSit Amet'
            ),
            {
                ops: [{ retain: 18 }, { insert: 'Omg Writing some text\n' }]
            }
        )
    })

    it('should diff embed', () => {
        test(
            new Delta().insert('Tomas test'),
            new Delta().insert('Tomas test').insert({
                [CustomEmbeds.EmojiEmbed]: {
                    unified: '1F60D'
                }
            }),
            {
                ops: [
                    { retain: 10 },
                    { insert: { 'emoji-embed': { unified: '1F60D' } } }
                ]
            }
        )

        test(
            new Delta()
                .insert('Title')
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '022'
                    }
                })
                .insert('Some text'),
            new Delta()
                .insert('Different')
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '456'
                    }
                })
                .insert('Lorem ipsum')
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '022'
                    }
                }),
            {
                ops: [
                    { insert: 'Different' },
                    { insert: { 'block-embed': { uuid: '456' } } },
                    { insert: 'Lorem' },
                    { delete: 10 },
                    { retain: 1 },
                    { insert: 'ipsum' },
                    { insert: { 'block-embed': { uuid: '022' } } },
                    { delete: 4 }
                ]
            }
        )

        test(
            new Delta()
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '022'
                    }
                })
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '123'
                    }
                }),
            new Delta()
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '022'
                    }
                })
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '456'
                    }
                })
                .insert({
                    [CustomEmbeds.BlockEmbed]: {
                        uuid: '123'
                    }
                }),
            {
                ops: [
                    { insert: { 'block-embed': { uuid: '022' } } },
                    { insert: { 'block-embed': { uuid: '456' } } },
                    { insert: { 'block-embed': { uuid: '123' } } },
                    { delete: 2 }
                ]
            }
        )
    })

    it('should diff block embeds', () => {
        test(
            new Delta().insert({
                [CustomEmbeds.BlockEmbed]: {
                    uuid: '022'
                }
            }),
            new Delta().insert({
                [CustomEmbeds.BlockEmbed]: {
                    uuid: '123'
                }
            }),
            {
                ops: [
                    { insert: { 'block-embed': { uuid: '123' } } },
                    { delete: 1 }
                ]
            }
        )
    })

    it('should diff emoji embeds', () => {
        test(
            new Delta().insert({
                [CustomEmbeds.EmojiEmbed]: {
                    unified: '1F60D'
                }
            }),
            new Delta().insert({
                [CustomEmbeds.EmojiEmbed]: {
                    unified: '2F70E'
                }
            }),
            {
                ops: [
                    { insert: { 'emoji-embed': { unified: '2F70E' } } },
                    { delete: 1 }
                ]
            }
        )
    })

    it('should diff mention embeds', () => {
        test(
            new Delta().insert({
                [CustomEmbeds.Mention]: {
                    name: 'Tomas'
                }
            }),
            new Delta().insert({
                [CustomEmbeds.Mention]: {
                    name: 'David'
                }
            }),
            {
                ops: [{ insert: { mention: { name: 'David' } } }, { delete: 1 }]
            }
        )
    })

    it('should diff document mention embeds', () => {
        test(
            new Delta().insert({
                [CustomEmbeds.Mention]: {
                    name: 'Tomas'
                }
            }),
            new Delta().insert({
                [CustomEmbeds.DocumentMention]: {}
            }),
            {
                ops: [{ insert: { 'document-mention': {} } }, { delete: 1 }]
            }
        )
    })
})
