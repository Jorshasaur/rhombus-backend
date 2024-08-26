import * as Delta from 'quill-delta'

export interface PaneContents {
    revision: number
    contents: Pane
}

export interface PaneList {
    id: string
    metadata: object
    elements: PaneList[] | PaneElement[]
}

export interface Pane extends PaneList {
    viewType: PaneViewType
}

export type PaneElement = PaneImage | PaneSelect | PaneText

export interface IPaneElement {
    type: PaneElementType
    threadIds?: string[]
    hasUpdates?: boolean
}

export interface PaneImage extends IPaneElement {
    type: PaneElementType.IMAGE
    value: {
        height: number
        id: string
        width: number
    }
}

export interface PaneSelect extends IPaneElement {
    type: PaneElementType.SELECT
    value: string
}

export interface PaneText extends IPaneElement {
    type: PaneElementType.TEXT
    value: Delta
}

export enum PaneElementType {
    TEXT = 'text',
    IMAGE = 'image',
    SELECT = 'select'
}

export enum PaneViewType {
    TABLE = 'table'
}
