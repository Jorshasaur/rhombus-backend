export type TextOpComponent = number | string | { d: number }
export type TextOp = TextOpComponent[]

export type JSONOpComponent = {
    i?: any // insert
    r?: any // remove
    p?: number // pick
    d?: number // drop

    es?: TextOp // Edit string
    en?: number // Edit number

    e?: any // Arbitrary edit
    et?: string // and the edit type
}

export type JSONOp = (number | string | JSONOpComponent | JSONOp)[]
export type Path = (number | string)[]
type Doc = any

export const type: {
    name: 'json1'

    readCursor(): void
    writeCursor(): void
    create(val?: Doc): Doc
    registerSubtype(subtype: any): void
    checkValidOp(op: JSONOp): void
    normalize(op: JSONOp): JSONOp
    apply(doc: Doc, op: JSONOp): Doc
    transform(op: JSONOp, other: JSONOp, side: 'left' | 'right'): JSONOp
    compose(a: JSONOp, b: JSONOp): JSONOp
    transformPosition(path: Path, op: JSONOp): Path
    transformNoConflict(
        op: JSONOp,
        other: JSONOp,
        side: 'left' | 'right'
    ): JSONOp
}

export function removeOp(path: Path, value?: any): JSONOp
export function moveOp(from: Path, to: Path): JSONOp
export function insertOp(path: Path, value: any): JSONOp
export function replaceOp(path: Path, oldVal: any, newVal: any): JSONOp
export function editOp(path: Path, type: string | any, subOp: any): JSONOp
