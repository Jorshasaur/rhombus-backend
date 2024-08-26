import * as Delta from 'quill-delta'
import * as json1 from 'ot-json1'

export interface Operation {
    documentId: string
    submissionId: string
    revision: number
    type: OperationType
    revert: boolean
    operation: object
}

export enum OperationType {
    DELTA = 'delta',
    JSON1 = 'json1'
}

export interface DeltaOperation extends Operation {
    operation: { ops: Delta.DeltaOperation[] }
    type: OperationType.DELTA
}

export interface PaneOperation extends Operation {
    operation: { ops: json1.JSONOp }
    type: OperationType.JSON1
    paneId: string
}
