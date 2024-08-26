import { DeltaStatic } from 'quill-delta'

export interface DocumentContents {
    revision: number
    delta: DeltaStatic
}
