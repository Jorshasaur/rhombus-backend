import * as Delta from 'quill-delta'
import eachLine, { LineType } from '../../../util/EachLine'
import { CustomEmbeds } from '../../../interfaces/CustomEmbeds'

describe('EachLine', () => {
    it('calls callback for each line', () => {
        const delta = new Delta().insert('Hello\nWorld!')
        const spy = jest.fn()
        eachLine(delta, spy)

        expect(spy).toHaveBeenCalledTimes(2)
        expect(spy).toHaveBeenNthCalledWith(
            1,
            {
                delta: new Delta().insert('Hello'),
                type: LineType.LINE,
                attributes: {}
            },
            0
        )
        expect(spy).toHaveBeenNthCalledWith(
            2,
            {
                delta: new Delta().insert('World!'),
                type: LineType.LINE,
                attributes: {}
            },
            1
        )
    })

    it('returns line attributes', () => {
        const delta = new Delta()
            .insert('Hello')
            .insert('\n', { header: 1 })
            .insert({ mention: { name: 'test' } })

        const spy = jest.fn()
        eachLine(delta, spy)

        expect(spy).toHaveBeenCalledTimes(2)
        expect(spy).toHaveBeenNthCalledWith(
            1,
            {
                delta: new Delta().insert('Hello'),
                type: LineType.LINE,
                attributes: { header: 1 }
            },
            0
        )
        expect(spy).toHaveBeenNthCalledWith(
            2,
            {
                delta: new Delta().insert({ mention: { name: 'test' } }),
                type: LineType.LINE,
                attributes: {}
            },
            1
        )
    })

    it('handles pane and block embeds', () => {
        const delta = new Delta()
            .insert('Hello\n')
            .insert({ [CustomEmbeds.PaneEmbed]: { pane: true } }, { author: 1 })
            .insert({ [CustomEmbeds.BlockEmbed]: { block: true } })
            .insert('World!\n')

        const spy = jest.fn()
        eachLine(delta, spy)

        expect(spy).toHaveBeenCalledTimes(4)
        expect(spy).toHaveBeenNthCalledWith(
            1,
            {
                delta: new Delta().insert('Hello'),
                type: LineType.LINE,
                attributes: {}
            },
            0
        )
        expect(spy).toHaveBeenNthCalledWith(
            2,
            {
                delta: new Delta().insert(
                    {
                        [CustomEmbeds.PaneEmbed]: { pane: true }
                    },
                    { author: 1 }
                ),
                type: LineType.EMBED,
                attributes: {}
            },
            1
        )
        expect(spy).toHaveBeenNthCalledWith(
            3,
            {
                delta: new Delta().insert({
                    [CustomEmbeds.BlockEmbed]: { block: true }
                }),
                type: LineType.EMBED,
                attributes: {}
            },
            2
        )
        expect(spy).toHaveBeenNthCalledWith(
            4,
            {
                delta: new Delta().insert('World!'),
                type: LineType.LINE,
                attributes: {}
            },
            3
        )
    })
})
