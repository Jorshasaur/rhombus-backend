import * as Delta from 'quill-delta'

export class Revision {
    save = jest.fn()
    snapshot?: Delta.DeltaOperation[]
    document?: any
    $get: any

    constructor(
        public revision: number,
        public delta: { ops: Delta.DeltaOperation[] }
    ) {}

    public getQuillDelta() {
        return new Delta(this.delta)
    }
}

export function getRevisions() {
    return [
        new Revision(0, {
            ops: [
                { insert: 'Untitled' },
                { insert: '\n', attributes: { header: 1 } },
                {
                    insert:
                        'This is a document whose text is synced in real time\n',
                    attributes: { author: '9' }
                }
            ]
        }),
        new Revision(1, {
            ops: [{ retain: 28 }, { retain: 5, attributes: { author: '9' } }]
        }),
        new Revision(2, {
            ops: [
                { retain: 28 },
                {
                    retain: 5,
                    attributes: {
                        mark: ['cjhulvfr600003i5pkk7tihnl'],
                        author: '9'
                    }
                }
            ]
        }),
        new Revision(3, {
            ops: [{ retain: 61 }, { insert: '\n', attributes: { author: '9' } }]
        })
    ]
}

export function getRevisionsComposedDelta(
    revisions: Revision[] = getRevisions()
) {
    let document = new Delta()
    revisions.forEach((revision) => {
        document = document.compose(revision.getQuillDelta())
    })
    return document
}
