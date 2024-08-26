import { Document } from '../../../models/Document'
import { DocumentRevision } from '../../../models/DocumentRevision'
import * as Delta from 'quill-delta'
import { Sequelize } from 'sequelize-typescript'
import { getRevisions, getRevisionsComposedDelta, Revision } from './utils'

describe('Document', () => {
    describe('Contents', () => {
        it('should return snapshot when snapshot revision and latest revision are same', async () => {
            const snapshot = [
                { insert: 'Untitled' },
                { insert: '\n', attributes: { header: 1 } },
                {
                    insert:
                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent ut luctus ligula. Donec dignissim ut eros non venenatis. Mauris elementum faucibus tortor id ultrices. Mauris sit amet nisl tortor. Integer ligula risus, ultrices vitae lectus in, commodo scelerisque urna. Aliquam dignissim tellus tempus nunc feugiat, eget semper libero auctor. Mauris sit amet iaculis erat. Proin mollis tempor risus, eget finibus felis volutpat id. Morbi suscipit maximus lacus. Aliquam erat volutpat. Proin pharetra lorem sit amet hendrerit blandit. Donec condimentum vel sem non molestie. Nulla quis neque vulputate, lobortis massa ut, bibendum ipsum. Fusce sit amet ipsum eget nisi bibendum lobortis ac vel tellus. Morbi suscipit sapien non massa semper, eu pretium eros sagittis. Pellentesque vehicula tincidunt rutrum. Curabitur sit amet est non ligula semper ultrices. Sed et mollis nulla. Nulla fermentum libero vitae placerat laoreet. Sed eget scelerisque libero. Etiam laoreet justo ligula, id dignissim elit dictum non.',
                    attributes: { author: '9' }
                },
                {
                    insert: {
                        image: 'https://labslocalhost.com:3000/static/image.png'
                    },
                    attributes: { author: '9' }
                },
                {
                    insert:
                        ' Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent ut luctus ligula. Donec dignissim ut eros non venenatis. Mauris elementum faucibus tortor id ultrices. Mauris sit amet nisl tortor. Integer ligula risus, ultrices vitae lectus in, commodo scelerisque urna. Aliquam dignissim tellus tempus nunc feugiat, eget semper libero auctor. Mauris sit amet iaculis erat. Proin mollis tempor risus, eget finibus felis volutpat id. Morbi suscipit maximus lacus. Aliquam erat volutpat. Proin pharetra lorem sit amet hendrerit blandit. Donec condimentum vel sem non molestie. Nulla quis neque vulputate, lobortis massa ut, bibendum ipsum. Fusce sit amet ipsum eget nisi bibendum lobortis ac vel tellus. Morbi suscipit sapien non massa semper, eu pretium eros sagittis. Pellentesque vehicula tincidunt rutrum. Curabitur sit amet est non ligula semper ultrices. Sed et mollis nulla. Nulla fermentum libero vitae placerat laoreet. Sed eget scelerisque libero. Etiam laoreet justo ligula, id dignissim elit dictum non.',
                    attributes: { author: '9' }
                },
                { insert: '\n' }
            ]
            const snapshotRevision = 24

            DocumentRevision.findOne = jest.fn((options: any) => {
                if (options.where) {
                    if (options.where.snapshot != null) {
                        return {
                            revision: snapshotRevision,
                            snapshot
                        }
                    } else {
                        return {
                            revision: snapshotRevision
                        }
                    }
                }
                return Promise.reject('invalid query')
            })

            const contents = await Document.prototype.contents()
            expect(contents).toEqual({
                delta: new Delta(snapshot),
                revision: snapshotRevision
            })
        })

        it('should compose document from revisions when there is no snapshot', async () => {
            const revisions = getRevisions()

            DocumentRevision.findOne = jest.fn((options) => {
                if (options.where.hasOwnProperty('snapshot')) {
                    return null
                }
                return revisions[revisions.length - 1]
            })

            Document.prototype.$get = jest.fn(() => {
                return revisions
            })

            const contents = await Document.prototype.contents()

            const getOptions = {
                order: [['revision', 'ASC']],
                where: {
                    revision: { [Sequelize.Op.lte]: 3 }
                }
            }

            expect(Document.prototype.$get).toBeCalledWith(
                'revisions',
                getOptions
            )
            expect(contents.revision).toEqual(3)
            expect(contents.delta).toEqual(getRevisionsComposedDelta())
        })

        it('should compose document from snapshot and revisions', async () => {
            const revisions = getRevisions()
            const snapshot = getRevisionsComposedDelta()

            const revision4 = new Revision(4, {
                ops: [
                    { retain: 62 },
                    { insert: '@', attributes: { author: '9' } }
                ]
            })
            revisions.push(revision4)

            DocumentRevision.findOne = jest.fn((options: any) => {
                if (options.where) {
                    if (options.where.snapshot != null) {
                        return {
                            revision: 3,
                            snapshot
                        }
                    } else {
                        return {
                            revision: 4
                        }
                    }
                }
                return Promise.reject('invalid query')
            })

            Document.prototype.$get = jest.fn(() => {
                return [revision4]
            })

            const contents = await Document.prototype.contents()

            const getOptions = {
                order: [['revision', 'ASC']],
                where: {
                    revision: { [Sequelize.Op.gt]: 3, [Sequelize.Op.lte]: 4 }
                }
            }

            expect(contents.delta).toEqual(getRevisionsComposedDelta(revisions))
            expect(Document.prototype.$get).toBeCalledWith(
                'revisions',
                getOptions
            )
            expect(revision4.save).not.toBeCalled()
        })
    })

    describe('SaveSnapshot', () => {
        it('should save snapshot for revision', async () => {
            const revisions = getRevisions()
            const lastRevision = revisions[revisions.length - 1]
            const delta = getRevisionsComposedDelta(revisions)

            Document.prototype.contents = jest.fn(() => {
                return {
                    delta,
                    revision: lastRevision.revision
                }
            })

            DocumentRevision.findOne = jest.fn(() => {
                return lastRevision
            })

            await Document.prototype.saveSnapshot()

            expect(lastRevision.snapshot).toEqual(delta.ops!)
            expect(lastRevision.save).toBeCalled()
        })
    })
    describe('Diff', () => {
        it('should get the diff from a revision', async () => {
            const revisions = getRevisions()
            const lastRevision = revisions[revisions.length - 1]
            const delta = getRevisionsComposedDelta(revisions)
            const previousDelta = getRevisionsComposedDelta(
                revisions.slice(0, revisions.length - 1)
            )
            Document.prototype.contents = jest.fn((options, atRevision) => {
                if (atRevision) {
                    return {
                        delta: previousDelta,
                        revision: revisions[revisions.length - 2]
                    }
                }
                return {
                    delta,
                    revision: lastRevision.revision
                }
            })

            const diff = await Document.prototype.getDiff(revisions.length - 1)
            const lastDiffOp = diff.ops![diff.ops!.length - 1]
            expect(lastDiffOp).toHaveProperty('attributes')
            expect(lastDiffOp.attributes).toHaveProperty('added')
        })

        it('should mark space as added if next word after space is added', async () => {
            const previousDelta = new Delta().insert('Some text another text')
            const delta = new Delta()
                .insert('Some text')
                .insert(' ')
                .insert('more', { bold: true })
                .insert(' ')
                .insert('stuff', { italic: true })

            Document.prototype.contents = jest.fn((options, atRevision) => {
                if (atRevision) {
                    return {
                        delta: previousDelta,
                        revision: 1
                    }
                }
                return {
                    delta,
                    revision: 2
                }
            })

            const diff = await Document.prototype.getDiff(1)

            expect(diff).toEqual({
                ops: [
                    { insert: 'Some text ' },
                    { attributes: { added: true, bold: true }, insert: 'more' },
                    { attributes: { added: true }, insert: ' ' },
                    {
                        attributes: { added: true, italic: true },
                        insert: 'stuff'
                    }
                ]
            })
        })

        it('should filter out invalid operations', async () => {
            const previousDelta = new Delta().insert('Some text another text')
            const delta = new Delta()
                .insert('Lorem ipsum')
                .retain(12)
                .delete(1)

            Document.prototype.contents = jest.fn((options, atRevision) => {
                if (atRevision) {
                    return {
                        delta: previousDelta,
                        revision: 1
                    }
                }
                return {
                    delta,
                    revision: 2
                }
            })

            const diff = await Document.prototype.getDiff(1)

            expect(diff).toEqual({
                ops: [
                    { attributes: { added: true }, insert: 'Lorem' },
                    { attributes: { added: true }, insert: ' ' },
                    { attributes: { added: true }, insert: 'ipsum' }
                ]
            })
        })
    })
})
