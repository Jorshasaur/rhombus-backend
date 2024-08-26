import * as fs from 'fs'
import * as juice from 'juice'
import * as path from 'path'
import { DeltaOperation } from 'quill-delta'
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html'
import { Sequelize } from 'sequelize-typescript'
import * as URI from 'urijs'
import bugsnag from '../../bugsnag'
import { Config } from '../../config'
import { BlockEmbed } from '../../interfaces/BlockEmbed'
import { BlotSize } from '../../interfaces/BlotSize'
import { CustomEmbeds } from '../../interfaces/CustomEmbeds'
import { FreehandHeaders } from '../../interfaces/FreehandHeaders'
import { Mention } from '../../interfaces/Mention'
import {
    Pane as IPane,
    PaneElement,
    PaneElementType,
    PaneImage,
    PaneList,
    PaneSelect,
    PaneText
} from '../../interfaces/PaneContents'
import { PaneEmbed } from '../../interfaces/PaneEmbed'
import { ThumbnailResponse } from '../../interfaces/ThumbnailResponse'
import { User } from '../../interfaces/User'
import { RequestTracing } from '../../middleware/RequestTracing'
import { Asset } from '../../models/Asset'
import { Document } from '../../models/Document'
import { Pane } from '../../models/Pane'
import AssetsApiService, {
    AssetResponse
} from '../../services/AssetsApiService'
import FreehandApiService from '../../services/FreehandApiService'
import PresentationsApiService from '../../services/PresentationsApiService'
import PrototypesApiService, {
    PrototypeResult
} from '../../services/PrototypesApiService'
import { Logger } from '../Logger'
import './patchOpToHtmlConverter'

const emailClassPrefix = 'rhombus-email-class'

const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8')

export interface QuillDeltaToHtmlConverterOptions {
    orderedListTag?: string
    bulletListTag?: string
    listItemTag?: string
    paragraphTag?: string
    classPrefix?: string
    encodeHtml?: boolean
    multiLineBlockquote?: boolean
    multiLineHeader?: boolean
    multiLineCodeblock?: boolean
    multiLineParagraph?: boolean
    paneTableGrid?: boolean
    linkRel?: string
    allowBackgroundClasses?: boolean
    renderEmojiAsImage?: boolean
    includeStyles?: boolean
}

interface FileBlockEmbedData {
    id: string
    fileName: string
}

interface EmojiEmbed {
    name: string
    skin: string
    unified: string
    skinCode: string
    shortName: string
    baseString: string
    nonQualified: string
}

export interface ConverterInsert {
    type: string
    value: BlockEmbed | Mention | EmojiEmbed | PaneEmbed
}

interface ConverterAttributes {
    author?: number
    added?: boolean
}

export interface ConverterOperation {
    insert: ConverterInsert
    attributes?: ConverterAttributes
}

export interface FreehandDetails {
    type: string
    slug: string
}

export interface ApiResponse {
    thumbnailUrl: string
    name: string
    updatedAt?: string
}

class FreehandType {
    static PRIVATE = 'private'
    static PUBLIC = 'public'
}

export class CustomBlotServices {
    static IMAGE = 'image'
    static FREEHAND = 'freehand'
    static PROTOTYPE = 'prototype'
    static FILE = 'file'
    static FLAT_PROTOTYPE = 'invision'
    static PANE = 'pane'
}

function wasAdded(attributes?: ConverterAttributes) {
    return attributes != null && attributes.added
}

interface RetrievedAssets {
    [assetId: string]: AssetResponse | null
}

interface RetrievedResources {
    assets: RetrievedAssets
}

export interface RetrievedPanes {
    [key: string]: IPane | undefined
}

export class QuillDeltaConverter {
    static readonly defaultOptions: QuillDeltaToHtmlConverterOptions = {
        multiLineParagraph: false,
        paneTableGrid: false
    }
    converter: any
    retrievedAssets: RetrievedAssets
    retrievedFreehands: { [key: string]: ThumbnailResponse | null }
    retrievedPrototypes: { [key: string]: ThumbnailResponse | null }
    retrievedFlatPrototypes: { [key: string]: PrototypeResult | null }
    retrievedPanes: RetrievedPanes
    document: Document
    assetsApiService = new AssetsApiService()
    freehandApiService = new FreehandApiService()
    prototypesApiService = new PrototypesApiService()
    presentationsApiService = new PresentationsApiService()
    deltaOps: DeltaOperation[]
    logger = Logger
    options: QuillDeltaToHtmlConverterOptions

    constructor(
        private user: User,
        private freehandHeaders: FreehandHeaders,
        private requestTracing: RequestTracing
    ) {}

    /**
     * Takes a document and its delta operations and converts it to HTML
     * @param document the document object
     * @param deltaOps delta ops to convert to HTML
     * @param options any options to pass along to QuillDeltaToHtmlConverter
     */
    async convert(
        document: Document,
        deltaOps: DeltaOperation[],
        paneUpdates?: RetrievedPanes,
        options?: QuillDeltaToHtmlConverterOptions
    ): Promise<string> {
        this.deltaOps = this.preprocessOps(deltaOps)
        this.document = document
        this.options = Object.assign(
            {},
            QuillDeltaConverter.defaultOptions,
            options
        )
        this.converter = new QuillDeltaToHtmlConverter(deltaOps, this.options)
        this.converter.converterOptions.getCssClassesForOp = this.getCssClassesForOp
        this.retrievedPanes = paneUpdates || {}

        this.addCustomRenderers()
        await this.findAllAssetUrlsForDocument()
        await this.findAllExternalUrlsForDocument()
        let html = this.converter.convert()
        if (this.options.includeStyles) {
            html = juice.inlineContent(html, styles, {
                inlinePseudoElements: true
            })
        }
        return html
    }

    /**
     * Converts a list of author names to an html string
     * @param authors an array of author names
     */
    public convertAuthorship(authors: string[]) {
        const formatAuthor = (author: string) => `<b>${author}</b>`

        if (authors.length > 1) {
            // prettier-ignore
            return `<p>Updates from ${authors.slice(0, authors.length - 1).map(formatAuthor).join(', ')} and ${formatAuthor(authors[authors.length - 1])}</p>`
        }

        return `<p>Updates from ${authors.map(formatAuthor)}</p>`
    }

    convertPaneText(
        document: Document,
        deltaOps: DeltaOperation[],
        options?: QuillDeltaToHtmlConverterOptions,
        retrievedResources?: RetrievedResources,
        hasUpdates: boolean = false
    ) {
        if (hasUpdates) {
            this.deltaOps = this.addUpdatedToOps(deltaOps)
        }
        this.deltaOps = this.preprocessOps(deltaOps)
        this.document = document
        this.options = Object.assign(
            {},
            QuillDeltaConverter.defaultOptions,
            options
        )

        if (retrievedResources) {
            this.retrievedAssets = retrievedResources.assets
        }

        this.converter = new QuillDeltaToHtmlConverter(deltaOps, this.options)
        this.converter.converterOptions.getCssClassesForOp = this.getCssClassesForOp

        this.addCustomRenderers()

        const html = this.converter.convert()
        if (this.options.includeStyles) {
            return juice.inlineContent(html, styles, {
                inlinePseudoElements: true
            })
        }
        return html
    }

    private getCssClassesForOp(op: DeltaOperation) {
        if (wasAdded(op.attributes)) {
            return [`${emailClassPrefix}_change`]
        }
        return []
    }

    private addUpdatedToOps(deltaOps: DeltaOperation[]) {
        deltaOps.map((op) => {
            op.attributes = Object.assign(op.attributes || {}, { added: true })
        })
        return deltaOps
    }

    private preprocessOps(deltaOps: DeltaOperation[]) {
        return deltaOps.map((op) => {
            if (op.insert != null) {
                if (
                    op.insert[CustomEmbeds.BlockEmbed] != null ||
                    op.insert[CustomEmbeds.PaneEmbed] != null
                ) {
                    if (op.attributes == null) {
                        op.attributes = {}
                    }
                    op.attributes.renderAsBlock = true
                } else if (op.attributes != null && op.attributes.divider) {
                    op.attributes.renderAsBlock = true
                    op.insert = {
                        [CustomEmbeds.Divider]: {}
                    }
                }
            }

            return op
        })
    }

    private getEmojiUrl(unified: string) {
        return `${Config.cdn}/invisionapp-email-assets/rhombus/emoji/${unified}.png`
    }

    private getFileNameParts(fullFileName: string) {
        const fileNameArray = fullFileName.split('.')
        let fileName
        let ext = ''
        if (fileNameArray.length > 1) {
            ext = `.${fileNameArray.splice(-1)}`
            fileName = fileNameArray.join('.')
        } else {
            fileName = fullFileName
        }
        return {
            fileName,
            ext
        }
    }

    private getFileTypeClass(fileName: string) {
        const fileNameArray = fileName.split('.')
        const ext = fileNameArray[fileNameArray.length - 1]

        switch (ext) {
            case 'studio':
                return `${emailClassPrefix}_studio`
            case 'sketch':
                return `${emailClassPrefix}_sketch`
            case 'pdf':
                return `${emailClassPrefix}_pdf`
            case 'xlsx':
            case 'xls':
                return `${emailClassPrefix}_excel`
            case 'docx':
            case 'doc':
                return `${emailClassPrefix}_word`
            case 'pptx':
            case 'ppt':
                return `${emailClassPrefix}_powerpoint`
            case 'mov':
            case 'mp4':
            case 'avi':
            case 'wmv':
            case 'webm':
            case 'ogv':
            case 'flv':
            case 'qt':
            case 'm4v':
                return `${emailClassPrefix}_movie`
            default:
                return `${emailClassPrefix}_unknown`
        }
    }

    private getEmbedHTML(
        type: string,
        name: string,
        thumbnailUrl: string | null | undefined,
        attributes?: ConverterAttributes
    ) {
        let html =
            `<div class="${this.getEmbedCssClasses('embed', attributes)}">` +
            `<div class="${emailClassPrefix}_header">` +
            `<span class="${emailClassPrefix}_file-icon ${emailClassPrefix}_embed-icon"></span>` +
            `${type} <span class="${emailClassPrefix}_name">${name}</span>` +
            '</div>'

        if (thumbnailUrl != null) {
            html += `<img class="${emailClassPrefix}_img" src="${thumbnailUrl}" />`
        }

        html += '</div>'

        return html
    }

    private getEmbedCssClasses(
        className: string,
        attributes?: ConverterAttributes
    ) {
        let prefixedClassName = `${emailClassPrefix}_${className}`
        if (wasAdded(attributes)) {
            return `${prefixedClassName} ${emailClassPrefix}_embed-change`
        }
        return prefixedClassName
    }

    private renderFile(
        embedData: FileBlockEmbedData,
        attributes?: ConverterAttributes
    ) {
        const { fileName, ext } = this.getFileNameParts(embedData.fileName)
        const fileTypeClass = this.getFileTypeClass(embedData.fileName)
        return (
            `<div class="${this.getEmbedCssClasses('file', attributes)}">` +
            `<span class="${emailClassPrefix}_file-icon ${fileTypeClass}"></span>${fileName}<span class="${emailClassPrefix}_extension">${ext}</span>` +
            '</div>'
        )
    }

    private isSmallSize(blockEmbed: BlockEmbed) {
        return blockEmbed.size != null && blockEmbed.size === BlotSize.Small
    }

    private renderFreehand(
        blockEmbed: BlockEmbed,
        attributes?: ConverterAttributes
    ) {
        const freehandData = this.retrievedFreehands[blockEmbed.uuid!]
        if (freehandData != null) {
            const thumbnailUrl = this.isSmallSize(blockEmbed)
                ? null
                : freehandData.thumbnailUrl

            return this.getEmbedHTML(
                'Freehand',
                freehandData.name,
                thumbnailUrl,
                attributes
            )
        } else {
            return this.getEmbedHTML('Freehand', '', null, attributes)
        }
    }

    private renderPrototype(
        blockEmbed: BlockEmbed,
        attributes?: ConverterAttributes
    ) {
        const presentationsData = this.retrievedPrototypes[blockEmbed.uuid!]
        const name = presentationsData ? presentationsData.name : ''
        let thumbnailUrl = null
        if (!this.isSmallSize(blockEmbed) && presentationsData != null) {
            thumbnailUrl = presentationsData.thumbnailUrl
        }

        return this.getEmbedHTML('Prototype', name, thumbnailUrl, attributes)
    }

    private renderFlatPrototype(
        blockEmbed: BlockEmbed,
        attributes?: ConverterAttributes
    ) {
        const prototype = this.retrievedFlatPrototypes[blockEmbed.uuid!]
        const name = prototype ? prototype.name : ''

        let thumbnailUrl = null
        if (!this.isSmallSize(blockEmbed) && prototype != null) {
            thumbnailUrl = prototype.thumbnail
        }

        return this.getEmbedHTML('Prototype', name, thumbnailUrl, attributes)
    }

    private renderPane(paneEmbed: PaneEmbed, attributes?: ConverterAttributes) {
        const pane = this.retrievedPanes[paneEmbed.embedData.pane]
        let rows = ''
        let columnCount = 0
        for (let row of pane!.elements) {
            const paneRow = row as PaneList
            columnCount = paneRow.elements.length
            const columns = this.getPaneColumns(paneRow)
            rows += this.options.paneTableGrid
                ? `${columns}`
                : `<tr>${columns}</tr>`
        }
        const table = this.options.paneTableGrid
            ? `<div class="table-grid inactive" style="--column-count:${columnCount};">${rows}</div>`
            : `<table>${rows}</table>`
        return table
    }

    private getPaneColumns(row: PaneList) {
        let html = ''
        const columnElement = this.options.paneTableGrid ? 'div' : 'td'
        const columnClass = this.options.paneTableGrid
            ? ' class="pane-editor table-cell ql-snow ql-container"'
            : ''

        let openingTag = `<${columnElement}${columnClass}>`
        let closingTag = `</${columnElement}>`

        for (let column of row.elements) {
            let element
            switch ((column as PaneElement).type) {
                case PaneElementType.IMAGE:
                    element = column as PaneImage
                    html += `${openingTag}<img class="${emailClassPrefix}_img" />${closingTag}`
                    break
                case PaneElementType.SELECT:
                    element = column as PaneSelect
                    html += `${openingTag}<b>A select with value of ${element.value}</b>${closingTag}`
                    break
                case PaneElementType.TEXT:
                    element = column as PaneText
                    const panesConverter = new QuillDeltaConverter(
                        this.user,
                        this.freehandHeaders,
                        this.requestTracing
                    )

                    const cellHTML = panesConverter.convertPaneText(
                        this.document,
                        element.value.ops!,
                        this.options,
                        { assets: this.retrievedAssets },
                        element.hasUpdates
                    )

                    if (this.options.paneTableGrid) {
                        html += `${openingTag}<div class="ql-editor">${cellHTML}</div>${closingTag}`
                    } else {
                        html += `${openingTag}${cellHTML}${closingTag}`
                    }
                    break
            }
        }
        return html
    }

    private renderImage(
        blockEmbed: BlockEmbed,
        attributes?: ConverterAttributes
    ) {
        const assetObject = this.retrievedAssets[blockEmbed.embedData.id]
        const url = assetObject ? assetObject.url : ''
        return `<img class="${this.getEmbedCssClasses(
            'img',
            attributes
        )}" src="${url}" />`
    }

    private renderLink(link: string, attributes?: ConverterAttributes) {
        const className = this.getEmbedCssClasses('link', attributes)
        return `<div class="${className}">${link}</div>`
    }

    private renderEmoji(
        emojiEmbed: EmojiEmbed,
        attributes?: ConverterAttributes
    ) {
        if (this.options.renderEmojiAsImage) {
            // used in emails
            const emojiUrl = this.getEmojiUrl(emojiEmbed.unified)

            let className = `${emailClassPrefix}_emoji`
            if (wasAdded(attributes)) {
                className += ` ${emailClassPrefix}_change`
            }

            return `<span class="${className}"><img src="${emojiUrl}" width="16" height="16" alt=":${emojiEmbed.shortName}:"/></span>`
        } else {
            // used in thumbnailer
            return `<span class="emoji-embed emoji-image emoji-image-${emojiEmbed.unified}">:${emojiEmbed.shortName}:</span>`
        }
    }

    private renderBlockEmbed(
        blockEmbed: BlockEmbed,
        attributes?: ConverterAttributes
    ) {
        const service = blockEmbed.service

        switch (service) {
            case CustomBlotServices.IMAGE:
                return this.renderImage(blockEmbed, attributes)
            case CustomBlotServices.FILE:
                return this.renderFile(
                    blockEmbed.embedData as FileBlockEmbedData,
                    attributes
                )
            case CustomBlotServices.FREEHAND:
                if (blockEmbed.uuid) {
                    return this.renderFreehand(blockEmbed, attributes)
                } else {
                    this.logger.error(
                        'Unable to render freehand blot to html because there is no uuid set'
                    )
                    return ''
                }
            case CustomBlotServices.PROTOTYPE:
                if (blockEmbed.uuid) {
                    return this.renderPrototype(blockEmbed, attributes)
                } else {
                    this.logger.error(
                        'Unable to render presentation blot to html because there is no uuid set'
                    )
                    return ''
                }
            case CustomBlotServices.FLAT_PROTOTYPE:
                if (blockEmbed.uuid) {
                    return this.renderFlatPrototype(blockEmbed, attributes)
                } else {
                    this.logger.error(
                        'Unable to render flat prototype blot to html because there is no uuid set'
                    )
                    return ''
                }
            default:
                if (blockEmbed.originalLink != null) {
                    return this.renderLink(blockEmbed.originalLink, attributes)
                }
                bugsnag.notify(
                    `QuillDeltaToHtmlConverter - unknown block embed - '${service}'`,
                    {
                        blockEmbed
                    }
                )
                return ''
        }
    }

    private renderMention(name: string, attributes?: ConverterAttributes) {
        let startingTag = '<a'
        if (wasAdded(attributes)) {
            startingTag += ` class="${emailClassPrefix}_change"`
        }

        return `${startingTag}>@${name}</a>`
    }

    private renderDivider(attributes?: ConverterAttributes) {
        if (wasAdded(attributes)) {
            return `<hr class="${emailClassPrefix}_change" />`
        } else {
            return '<hr />'
        }
    }

    addCustomRenderers() {
        this.converter.renderCustomWith((customOp: ConverterOperation) => {
            const embedType = customOp.insert.type

            switch (embedType) {
                case CustomEmbeds.BlockEmbed:
                    const blockEmbed = customOp.insert.value as BlockEmbed
                    return this.renderBlockEmbed(
                        blockEmbed,
                        customOp.attributes
                    )
                case CustomEmbeds.PaneEmbed:
                    const paneEmbed = customOp.insert.value as PaneEmbed
                    if (paneEmbed.uuid) {
                        return this.renderPane(paneEmbed, customOp.attributes)
                    } else {
                        this.logger.error(
                            'Unable to render pane to html because there is no uuid set'
                        )
                        return ''
                    }
                case CustomEmbeds.Mention:
                    const mention = customOp.insert.value as Mention
                    return this.renderMention(mention.name, customOp.attributes)
                case CustomEmbeds.DocumentMention:
                    return this.renderMention('Doc', customOp.attributes)
                case CustomEmbeds.EmojiEmbed:
                    return this.renderEmoji(
                        customOp.insert.value as EmojiEmbed,
                        customOp.attributes
                    )
                case CustomEmbeds.Divider:
                    return this.renderDivider(customOp.attributes)
                default:
                    bugsnag.notify(
                        `QuillDeltaToHtmlConverter - unknown blot - ${embedType}`,
                        {
                            op: customOp
                        }
                    )
                    return ''
            }
        })
    }

    async getAllAssets(documentId: string) {
        return await Asset.findAll<Asset>({
            where: {
                documentId,
                uploaded: {
                    [Sequelize.Op.is]: true
                }
            }
        })
    }

    async getAllAssetUrls(assets: Asset[]) {
        let urlCollection: RetrievedAssets = {}

        for (let asset of assets) {
            const urls = await this.assetsApiService.getUrls(
                [asset.assetKey],
                this.requestTracing,
                true
            )

            if (urls) {
                urlCollection[asset.id] = urls[0]
            } else {
                this.logger.error(
                    `Asset id: ${asset.id}, filename: ${asset.fileName} not found by Assets API`
                )
            }
        }

        return urlCollection
    }

    async findAllAssetUrlsForDocument() {
        const assets = await this.getAllAssets(this.document.id)
        this.retrievedAssets = await this.getAllAssetUrls(assets)
    }

    async findAllExternalUrlsForDocument() {
        this.retrievedFreehands = {}
        this.retrievedPrototypes = {}
        this.retrievedFlatPrototypes = {}

        for (let operation of this.deltaOps) {
            const op = operation
            if (op.insert != null && typeof op.insert !== 'string') {
                if (op.insert[CustomEmbeds.BlockEmbed] != null) {
                    const embed = op.insert[CustomEmbeds.BlockEmbed]!
                    switch (embed.service) {
                        case CustomBlotServices.FREEHAND:
                            const details = this.getFreehandDetails(op)
                            const freehand: ApiResponse | void = await this.freehandApiService.getFreehand(
                                details.slug,
                                this.requestTracing,
                                details.type,
                                this.freehandHeaders.ip,
                                this.freehandHeaders.userAgent
                            )
                            if (freehand) {
                                this.retrievedFreehands[embed.uuid] = freehand
                            } else {
                                this.logger.error(
                                    `Unable to load freehand ${embed.uuid} from Freehand API`
                                )
                            }
                            break
                        case CustomBlotServices.PROTOTYPE:
                            const id = this.getPresentationId(op)
                            const prototypeResponse: ApiResponse | void = await this.presentationsApiService.getPresentation(
                                this.user.userId,
                                this.user.teamId,
                                id,
                                this.requestTracing
                            )
                            if (prototypeResponse) {
                                this.retrievedPrototypes[
                                    embed.uuid
                                ] = prototypeResponse
                            } else {
                                this.logger.error(
                                    `Unable to load presentation ${embed.uuid} from presentations api`
                                )
                            }
                            break
                        case CustomBlotServices.FLAT_PROTOTYPE:
                            const url = embed.originalLink
                            const prototype = await this.prototypesApiService.getPrototypeByUrl(
                                url,
                                this.user.userId,
                                this.user.teamId,
                                this.requestTracing
                            )
                            if (prototype) {
                                this.retrievedFlatPrototypes[
                                    embed.uuid
                                ] = prototype
                            } else {
                                this.logger.error(
                                    `Unable to load flat prototype ${embed.uuid} from prototypes api`
                                )
                            }
                            break
                        default:
                            break
                    }
                } else if (op.insert[CustomEmbeds.PaneEmbed] != null) {
                    const embed = op.insert[CustomEmbeds.PaneEmbed]!
                    const paneId = embed.embedData.pane
                    if (!this.retrievedPanes[paneId]) {
                        const pane = await Pane.findOne({
                            where: { id: paneId }
                        })
                        this.retrievedPanes[paneId] = await (
                            await pane!.contents()
                        ).contents
                    }
                }
            }
        }
    }

    getFreehandDetails(embed: DeltaOperation): FreehandDetails {
        const url = URI(embed.insert[CustomEmbeds.BlockEmbed]!.originalLink!)
        return {
            slug: url.segment(-1),
            type:
                url.toString().indexOf('/public/') > -1
                    ? FreehandType.PUBLIC
                    : FreehandType.PRIVATE
        }
    }

    getPresentationId(embed: DeltaOperation): string {
        const url = URI(embed.insert[CustomEmbeds.BlockEmbed]!.originalLink!)
        const presentationSegment = url.segment(1)
        return presentationSegment.substring(
            presentationSegment.lastIndexOf('-') + 1
        )
    }
}
