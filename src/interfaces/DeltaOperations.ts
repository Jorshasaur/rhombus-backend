import { DeltaOperation } from 'quill-delta'

export type DeltaOperations = DeltaOperation[] | { ops: DeltaOperation[] }
