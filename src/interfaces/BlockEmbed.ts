import { BlotSize } from './BlotSize'

export interface BlockEmbed {
    id: string
    service?: string
    embedData: {
        id: string
        threadIds?: string[]
    }
    uuid: string
    originalLink?: string
    size?: BlotSize
}
