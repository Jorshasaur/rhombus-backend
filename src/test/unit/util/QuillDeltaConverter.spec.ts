import { DeltaOperation } from 'quill-delta'
import { BlotSize } from '../../../interfaces/BlotSize'
import { Asset } from '../../../models/Asset'
import { Pane } from '../../../models/Pane'
import FreehandApiService from '../../../services/FreehandApiService'
import PresentationsApiService from '../../../services/PresentationsApiService'
import PrototypesApiService from '../../../services/PrototypesApiService'
import {
    CustomBlotServices,
    QuillDeltaConverter
} from '../../../util/QuillDeltaConverter'
import {
    DEFAULT_REQUEST_TEAM_ID,
    DEFAULT_REQUEST_USER_ID,
    FreehandHeadersMock,
    RequestResponseMock,
    RequestTrackingMock
} from '../../utils'
import { getDocumentRecord } from '../controllers/utils'
import { PaneViewType } from '../../../interfaces/PaneContents'

describe('QuillDeltaConverter', () => {
    beforeEach(() => {
        Asset.findAll = jest.fn(() => {
            return []
        })
        Pane.findOne = jest.fn(() => {
            return {
                contents: () => {
                    return { contents: {} }
                }
            }
        })
    })

    it('should generate the correct html for an image', async () => {
        const requestResponseMock = new RequestResponseMock()

        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.IMAGE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        id: 'aabb-1234'
                    }
                }
            }
        }

        QuillDeltaConverter.prototype.getAllAssetUrls = jest.fn(() => {
            return {
                'aabb-1234': {
                    url: 'nothing.jpg'
                }
            }
        })

        const deltaOps = [operation]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const document = getDocumentRecord()

        let result = await converter.convert(document, deltaOps)
        expect(result).toEqual(
            '<img class="rhombus-email-class_img" src="nothing.jpg" />'
        )

        // added attribute
        deltaOps[0].attributes!.added = true
        result = await converter.convert(document, deltaOps)
        expect(result).toEqual(
            '<img class="rhombus-email-class_img rhombus-email-class_embed-change" src="nothing.jpg" />'
        )
    })

    it('should generate the correct html for a freehand', async () => {
        const requestResponseMock = new RequestResponseMock()

        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.FREEHAND,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink: 'https'
                }
            }
        }

        FreehandApiService.prototype.getFreehand = jest.fn(() => {
            return {
                thumbnailUrl: 'https://X_FORWARDED_HOST/freehand.jpg',
                name: 'Freehand Title'
            }
        })

        const deltaOps = [operation]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const document = getDocumentRecord()

        let result = await converter.convert(document, deltaOps)

        let expectedResult =
            '<div class="rhombus-email-class_embed">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Freehand <span class="rhombus-email-class_name">Freehand Title</span>' +
            '</div>' +
            '<img class="rhombus-email-class_img" src="https://X_FORWARDED_HOST/freehand.jpg" />' +
            '</div>'

        expect(result).toEqual(expectedResult)

        // small size
        const smallSizeDelta = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.FREEHAND,
                    version: 1,
                    authorId: '12',
                    size: BlotSize.Small,
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink: 'https://original-link'
                }
            }
        }

        result = await converter.convert(document, [smallSizeDelta])
        expectedResult =
            '<div class="rhombus-email-class_embed">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Freehand <span class="rhombus-email-class_name">Freehand Title</span>' +
            '</div>' +
            '</div>'

        expect(result).toEqual(expectedResult)

        // added attribute
        deltaOps[0].attributes!.added = true
        result = await converter.convert(document, deltaOps)

        expectedResult =
            '<div class="rhombus-email-class_embed rhombus-email-class_embed-change">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Freehand <span class="rhombus-email-class_name">Freehand Title</span>' +
            '</div>' +
            '<img class="rhombus-email-class_img" src="https://X_FORWARDED_HOST/freehand.jpg" />' +
            '</div>'

        expect(result).toEqual(expectedResult)
    })

    it('should generate the correct html for a presentation', async () => {
        const requestResponseMock = new RequestResponseMock()

        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.PROTOTYPE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink:
                        'https://nothing-nowhere-nope.com/not-a-thing/or-another-thing'
                }
            }
        }

        PresentationsApiService.prototype.getPresentation = jest.fn(() => {
            return {
                thumbnailUrl: 'presentation.jpg',
                name: 'Presentation Title'
            }
        })

        const deltaOps = [operation]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const document = getDocumentRecord()

        let result = await converter.convert(document, deltaOps)

        let expectedResult =
            '<div class="rhombus-email-class_embed">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Prototype <span class="rhombus-email-class_name">Presentation Title</span>' +
            '</div>' +
            '<img class="rhombus-email-class_img" src="presentation.jpg" />' +
            '</div>'

        expect(result).toEqual(expectedResult)

        // added attribute
        deltaOps[0].attributes!.added = true
        result = await converter.convert(document, deltaOps)

        expectedResult =
            '<div class="rhombus-email-class_embed rhombus-email-class_embed-change">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Prototype <span class="rhombus-email-class_name">Presentation Title</span>' +
            '</div>' +
            '<img class="rhombus-email-class_img" src="presentation.jpg" />' +
            '</div>'

        expect(result).toEqual(expectedResult)
    })

    it('should correctly get freehand details', () => {
        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.PROTOTYPE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink:
                        'https://nothing-nowhere-nope.com/public/or-another-thing'
                }
            }
        }
        const operationPrivate: DeltaOperation = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.PROTOTYPE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink:
                        'https://nothing-nowhere-nope.com/or-another-thing'
                }
            }
        }

        const user = { userId: 1 } as any
        const converter = new QuillDeltaConverter(
            user,
            new FreehandHeadersMock(),
            new RequestTrackingMock()
        )

        const details = converter.getFreehandDetails(operation)
        expect(details.slug).toEqual('or-another-thing')
        expect(details.type).toEqual('public')
        const privDetails = converter.getFreehandDetails(operationPrivate)
        expect(privDetails.type).toEqual('private')
    })

    it('should correctly get the presentation id', () => {
        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.PROTOTYPE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink:
                        'https://nothing-nowhere-nope.com/not-me/prototype-aabbccdd'
                }
            }
        }

        const user = { userId: 1 } as any
        const converter = new QuillDeltaConverter(
            user,
            new FreehandHeadersMock(),
            new RequestTrackingMock()
        )
        const id = converter.getPresentationId(operation)
        expect(id).toEqual('aabbccdd')
    })

    it('should generate the correct html and styles for an emoji', async () => {
        const requestResponseMock = new RequestResponseMock()

        const deltaOps: DeltaOperation[] = [
            {
                insert: 'Test – Dash — em dash',
                attributes: {
                    author: 7
                }
            },
            {
                insert: '\n'
            },
            {
                insert: {
                    'emoji-embed': {
                        name: 'SMILING FACE WITH HEART-SHAPED EYES',
                        skin: '1',
                        unified: '1F60D',
                        skinCode: '',
                        shortName: 'heart_eyes',
                        baseString: '1F60D',
                        nonQualified: ''
                    }
                },
                attributes: {
                    author: 7
                }
            },
            {
                insert: '\n\n',
                attributes: {
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const document = getDocumentRecord()

        let result = await converter.convert(
            document,
            deltaOps,
            {},
            {
                renderEmojiAsImage: true
            }
        )
        expect(result).toEqual(
            '<p>Test – Dash — em dash</p><p><span class="rhombus-email-class_emoji"><img src="https://invisionapp-cdn.com/invisionapp-email-assets/rhombus/emoji/1F60D.png" width="16" height="16" alt=":heart_eyes:"/></span></p><p><br/></p>'
        )

        // added attribute
        deltaOps[2].attributes!.added = true
        result = await converter.convert(
            document,
            deltaOps,
            {},
            {
                renderEmojiAsImage: true
            }
        )
        expect(result).toEqual(
            '<p>Test – Dash — em dash</p><p><span class="rhombus-email-class_emoji rhombus-email-class_change"><img src="https://invisionapp-cdn.com/invisionapp-email-assets/rhombus/emoji/1F60D.png" width="16" height="16" alt=":heart_eyes:"/></span></p><p><br/></p>'
        )

        result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<p>Test – Dash — em dash</p><p><span class="emoji-embed emoji-image emoji-image-1F60D">:heart_eyes:</span></p><p><br/></p>'
        )
    })

    it('should generate correct html for a file', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: {
                    'block-embed': {
                        uuid: '0c90e0e2-42e0-4e65-98ec-204949d889e0',
                        service: 'file',
                        version: 1,
                        authorId: 7,
                        createdAt: '2018-12-06T22:17:36.849Z',
                        embedData: {
                            id: '294de249-7ee4-4767-a250-85aaba7686f6',
                            fileName: 'text.txt'
                        }
                    }
                },
                attributes: {
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        let result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<div class="rhombus-email-class_file"><span class="rhombus-email-class_file-icon rhombus-email-class_unknown"></span>text<span class="rhombus-email-class_extension">.txt</span></div>'
        )

        // added attribute
        deltaOps[0].attributes!.added = true

        result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<div class="rhombus-email-class_file rhombus-email-class_embed-change"><span class="rhombus-email-class_file-icon rhombus-email-class_unknown"></span>text<span class="rhombus-email-class_extension">.txt</span></div>'
        )
    })

    it('should generate correct html for a original link embed', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: {
                    'block-embed': {
                        type: 'iframe',
                        uuid: '4ab68af8-a9e3-41ec-9ce1-27d95dd524c7',
                        service: 'youtube',
                        version: 1,
                        authorId: 7,
                        createdAt: '2018-12-10T18:39:44.790Z',
                        embedData: {},
                        originalLink:
                            'https://www.youtube.com/watch?v=Yn2XpuxDBgY'
                    }
                },
                attributes: {
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        let result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<div class="rhombus-email-class_link">https://www.youtube.com/watch?v=Yn2XpuxDBgY</div>'
        )

        // added attribute
        deltaOps[0].attributes!.added = true

        result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<div class="rhombus-email-class_link rhombus-email-class_embed-change">https://www.youtube.com/watch?v=Yn2XpuxDBgY</div>'
        )
    })

    it('should generate correct html for a mention', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: {
                    mention: {
                        id: 7,
                        name: 'Owner V7',
                        email: 'owner-v7@invisionapp.com',
                        userId: 7
                    }
                },
                attributes: {
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        let result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual('<p><a>@Owner V7</a></p>')

        // added attribute
        deltaOps[0].attributes!.added = true

        result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<p><a class="rhombus-email-class_change">@Owner V7</a></p>'
        )
    })

    it('should generate correct html for a document mention', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: {
                    'document-mention': {
                        documentMention: 'true'
                    }
                },
                attributes: {
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        let result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual('<p><a>@Doc</a></p>')

        // added attribute
        deltaOps[0].attributes!.added = true

        result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<p><a class="rhombus-email-class_change">@Doc</a></p>'
        )
    })

    it('should generate correct html for added text', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: 'Test\naa',
                attributes: {
                    author: 7
                }
            },
            {
                insert: 'a\naaa ',
                attributes: {
                    added: true,
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const result = await converter.convert(document, deltaOps, {})
        expect(result).toEqual(
            '<p>Test</p><p>aa<span class="rhombus-email-class_change">a</span></p><p><span class="rhombus-email-class_change">aaa </span></p>'
        )
    })

    it('should generate correct html with inline styles', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: 'Test\naa',
                attributes: {
                    author: 7
                }
            },
            {
                insert: 'a\naaa ',
                attributes: {
                    added: true,
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const result = await converter.convert(
            document,
            deltaOps,
            {},
            {
                includeStyles: true
            }
        )
        expect(result).toEqual(
            '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Test</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">aa<span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">a</span></p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><span class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;">aaa </span></p>'
        )
    })

    it('should generate correct html with inline styles for todo list', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: '\n',
                attributes: {
                    list: 'unchecked',
                    author: 7
                }
            },
            {
                insert: 'checked',
                attributes: {
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const result = await converter.convert(
            document,
            deltaOps,
            {},
            {
                includeStyles: true
            }
        )
        expect(result).toEqual(
            '<ul style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0;"><li data-checked="false" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px; list-style-type: none; margin-left: 15px;"><span style="display: inline-block; background-size: cover; height: 14px; overflow: visible; text-align: right; margin-right: 6px; background-image: url(https://invisionapp-cdn.com/invisionapp-email-assets/rhombus/icons/unchecked.png); width: 14px;"></span><br style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0;"></li></ul><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">checked</p>'
        )
    })

    it('should render divider', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: 'Title'
            },
            {
                insert: '\n',
                attributes: {
                    divider: true,
                    author: 7
                }
            },
            {
                insert: '\n',
                attributes: {
                    divider: true,
                    added: true,
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const result = await converter.convert(
            document,
            deltaOps,
            {},
            {
                includeStyles: true
            }
        )
        expect(result).toEqual(
            '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Title</p><hr style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; height: 2px; background: #e7ebf4; margin: 11px 0; border: none;"><hr class="rhombus-email-class_change" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; height: 2px; margin: 11px 0; border: none; background: rgba(9, 186, 166, 0.25); padding: 0;">'
        )
    })

    it('should render inline code', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: 'Title'
            },
            {
                insert: '\n',
                attributes: {
                    author: 7
                }
            },
            {
                insert: 'aaa',
                attributes: {
                    code: true,
                    added: true,
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const result = await converter.convert(
            document,
            deltaOps,
            {},
            {
                includeStyles: true
            }
        )
        expect(result).toEqual(
            '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Title</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><code class="rhombus-email-class_change" style="color: #434c5e; margin: 0; font-family: monaco; font-size: 12px; border-radius: 3px; padding: 2px 4px; background: rgba(9, 186, 166, 0.25);">aaa</code></p>'
        )
    })

    it('should render html for multiple inline attributes', async () => {
        const requestResponseMock = new RequestResponseMock()
        const document = getDocumentRecord()

        const deltaOps: DeltaOperation[] = [
            {
                insert: 'Title'
            },
            {
                insert: '\n',
                attributes: {
                    author: 7
                }
            },
            {
                insert: 'aaa',
                attributes: {
                    bold: true,
                    italic: true,
                    link: 'aaa',
                    strike: true,
                    underline: true,
                    code: true,
                    added: true,
                    author: 7
                }
            }
        ]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const result = await converter.convert(
            document,
            deltaOps,
            {},
            {
                includeStyles: true
            }
        )
        expect(result).toEqual(
            '<p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;">Title</p><p style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; font-size: 14px; line-height: 24px;"><a class="rhombus-email-class_change" href="unsafe:aaa" target="_blank" style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; margin: 0; background: rgba(9, 186, 166, 0.25); padding: 2px 0;"><strong style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; background: none;"><em style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; background: none;"><s style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; background: none;"><u style="font-family: Arial, Helvetica, sans-serif; color: #434c5e; padding: 0; margin: 0; background: none;"><code style="color: #434c5e; margin: 0; font-family: monaco; font-size: 12px; padding: 2px 4px; border-radius: 3px; background: none;">aaa</code></u></s></em></strong></a></p>'
        )
    })

    it('should generate the correct html for a flat prototype', async () => {
        const requestResponseMock = new RequestResponseMock()

        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.FLAT_PROTOTYPE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink: 'https://original-link'
                }
            }
        }

        const deltaOps = [operation]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        const document = getDocumentRecord()

        PrototypesApiService.prototype.getPrototypeByUrl = jest.fn(() => {
            return Promise.resolve({
                height: 0,
                isMobile: false,
                name: 'My Prototype',
                thumbnail: 'http://image.jpg',
                updatedAt: '2019-03-28T12:00:00Z',
                width: 0
            })
        })

        let result = await converter.convert(document, deltaOps, {})

        let expectedResult =
            '<div class="rhombus-email-class_embed">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Prototype <span class="rhombus-email-class_name">My Prototype</span>' +
            '</div>' +
            '<img class="rhombus-email-class_img" src="http://image.jpg" />' +
            '</div>'

        expect(result).toEqual(expectedResult)
        expect(PrototypesApiService.prototype.getPrototypeByUrl).toBeCalledWith(
            'https://original-link',
            DEFAULT_REQUEST_USER_ID,
            DEFAULT_REQUEST_TEAM_ID,
            requestResponseMock.request.tracing
        )

        // without thumbnail
        PrototypesApiService.prototype.getPrototypeByUrl = jest.fn(() => {
            return Promise.resolve({
                height: 0,
                isMobile: false,
                name: 'My Prototype',
                updatedAt: '2019-03-28T12:00:00Z',
                width: 0
            })
        })

        result = await converter.convert(document, deltaOps, {})
        expectedResult =
            '<div class="rhombus-email-class_embed">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Prototype <span class="rhombus-email-class_name">My Prototype</span>' +
            '</div>' +
            '</div>'

        expect(result).toEqual(expectedResult)

        // without name and thumbnail
        PrototypesApiService.prototype.getPrototypeByUrl = jest.fn(() => {
            return Promise.resolve(null)
        })

        result = await converter.convert(document, deltaOps, {})
        expectedResult =
            '<div class="rhombus-email-class_embed">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Prototype <span class="rhombus-email-class_name"></span>' +
            '</div>' +
            '</div>'

        expect(result).toEqual(expectedResult)

        // small size
        PrototypesApiService.prototype.getPrototypeByUrl = jest.fn(() => {
            return Promise.resolve({
                height: 0,
                isMobile: false,
                name: 'My Prototype',
                thumbnail: 'http://image.jpg',
                updatedAt: '2019-03-28T12:00:00Z',
                width: 0
            })
        })

        const smallSizeDelta = {
            attributes: {},
            insert: {
                'block-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.FLAT_PROTOTYPE,
                    version: 1,
                    authorId: '12',
                    size: BlotSize.Small,
                    embedData: {
                        id: 'aabb-1234'
                    },
                    originalLink: 'https://original-link'
                }
            }
        }

        result = await converter.convert(document, [smallSizeDelta], {})
        expectedResult =
            '<div class="rhombus-email-class_embed">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Prototype <span class="rhombus-email-class_name">My Prototype</span>' +
            '</div>' +
            '</div>'

        expect(result).toEqual(expectedResult)

        // added attribute
        deltaOps[0].attributes!.added = true
        result = await converter.convert(document, deltaOps, {})

        expectedResult =
            '<div class="rhombus-email-class_embed rhombus-email-class_embed-change">' +
            '<div class="rhombus-email-class_header">' +
            '<span class="rhombus-email-class_file-icon rhombus-email-class_embed-icon"></span>Prototype <span class="rhombus-email-class_name">My Prototype</span>' +
            '</div>' +
            '<img class="rhombus-email-class_img" src="http://image.jpg" />' +
            '</div>'

        expect(result).toEqual(expectedResult)
    })

    it('should generate the right html for a pane', async () => {
        const requestResponseMock = new RequestResponseMock()

        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'pane-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.PANE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        pane: 'aabb-1234'
                    }
                }
            }
        }

        const deltaOps = [operation]

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        QuillDeltaConverter.prototype.getAllAssetUrls = jest.fn(() => {
            return {
                'aabb-1234': {
                    url: 'nothing.jpg'
                }
            }
        })

        const document = getDocumentRecord()
        const paneContents = {
            id: operation.insert['pane-embed'].embedData.pane,
            viewType: PaneViewType.TABLE,
            elements: [
                {
                    id: 'aabbcc-dd',
                    elements: [
                        {
                            type: 'image',
                            value: {
                                height: 900,
                                width: 900,
                                id: 'aabbcc-dd-ee-ff-123'
                            }
                        }
                    ]
                },
                {
                    id: 'ccdd-ee',
                    elements: [
                        {
                            type: 'text',
                            value: {
                                ops: [
                                    {
                                        insert:
                                            'Take two and call me in the morning'
                                    },
                                    {
                                        attributes: {},
                                        insert: {
                                            'block-embed': {
                                                uuid: 'aabb-1234',
                                                service:
                                                    CustomBlotServices.IMAGE,
                                                version: 1,
                                                authorId: '12',
                                                embedData: {
                                                    id: 'aabb-1234'
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            type: 'select',
                            value: 'false'
                        }
                    ]
                }
            ]
        } as any
        let result = await converter.convert(document, deltaOps, {
            'aabb-1234': paneContents
        })
        expect(result).toEqual(
            '<table><tr><td><img class="rhombus-email-class_img" /></td></tr><tr><td><p>Take two and call me in the morning</p><img class="rhombus-email-class_img" src="nothing.jpg" /></td><td><b>A select with value of false</b></td></tr></table>'
        )
    })
    it('should generate the right html for a pane as a grid element', async () => {
        const requestResponseMock = new RequestResponseMock()

        const operation: DeltaOperation = {
            attributes: {},
            insert: {
                'pane-embed': {
                    uuid: 'aabb-1234',
                    service: CustomBlotServices.PANE,
                    version: 1,
                    authorId: '12',
                    embedData: {
                        pane: 'aabb-1234'
                    }
                }
            }
        }

        const deltaOps = [operation]
        const document = getDocumentRecord()

        const converter = new QuillDeltaConverter(
            requestResponseMock.request.invision.user,
            new FreehandHeadersMock(),
            requestResponseMock.request.tracing
        )

        QuillDeltaConverter.prototype.getAllAssetUrls = jest.fn(() => {
            return {
                'aabb-1234': {
                    url: 'nothing.jpg'
                }
            }
        })

        const paneContents = {
            id: operation.insert['pane-embed'].embedData.pane,
            viewType: PaneViewType.TABLE,
            elements: [
                {
                    id: 'aabbcc-dd',
                    elements: [
                        {
                            type: 'image',
                            value: {
                                height: 900,
                                width: 900,
                                id: 'aabbcc-dd-ee-ff-123'
                            }
                        }
                    ]
                },
                {
                    id: 'ccdd-ee',
                    elements: [
                        {
                            type: 'text',
                            value: {
                                ops: [
                                    {
                                        insert:
                                            'Take two and call me in the morning'
                                    },
                                    {
                                        attributes: {},
                                        insert: {
                                            'block-embed': {
                                                uuid: 'aabb-1234',
                                                service:
                                                    CustomBlotServices.IMAGE,
                                                version: 1,
                                                authorId: '12',
                                                embedData: {
                                                    id: 'aabb-1234'
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            type: 'select',
                            value: 'false'
                        }
                    ]
                }
            ]
        } as any
        let result = await converter.convert(
            document,
            deltaOps,
            { 'aabb-1234': paneContents },
            {
                paneTableGrid: true
            }
        )
        expect(result).toMatchInlineSnapshot(
            `"<div class=\\"table-grid inactive\\" style=\\"--column-count:2;\\"><div class=\\"pane-editor table-cell ql-snow ql-container\\"><img class=\\"rhombus-email-class_img\\" /></div><div class=\\"pane-editor table-cell ql-snow ql-container\\"><div class=\\"ql-editor\\"><p>Take two and call me in the morning</p><img class=\\"rhombus-email-class_img\\" src=\\"nothing.jpg\\" /></div></div><div class=\\"pane-editor table-cell ql-snow ql-container\\"><b>A select with value of false</b></div></div>"`
        )
    })
})
