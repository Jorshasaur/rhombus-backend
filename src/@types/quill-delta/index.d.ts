declare class d implements d.DeltaStatic {
    constructor(ops?: d.DeltaOperation[] | { ops: d.DeltaOperation[] })
    ops?: d.DeltaOperation[]
    retain(length: number, attributes?: d.StringMap): d.DeltaStatic
    push(newOp: d.DeltaOperation): d.DeltaStatic
    delete(length: number): d.DeltaStatic
    filter(predicate: (op: d.DeltaOperation) => boolean): d.DeltaOperation[]
    forEach(predicate: (op: d.DeltaOperation, index: number) => void): void
    insert(text: any, attributes?: d.StringMap): d.DeltaStatic
    map<T>(predicate: (op: d.DeltaOperation) => T): T[]
    partition(
        predicate: (op: d.DeltaOperation) => boolean
    ): [d.DeltaOperation[], d.DeltaOperation[]]
    reduce<T>(
        predicate: (
            acc: T,
            curr: d.DeltaOperation,
            idx: number,
            arr: d.DeltaOperation[]
        ) => T,
        initial: T
    ): T
    chop(): d.DeltaStatic
    length(): number
    slice(start?: number, end?: number): d.DeltaStatic
    compose(other: d.DeltaStatic): d.DeltaStatic
    concat(other: d.DeltaStatic): d.DeltaStatic
    diff(other: d.DeltaStatic, index?: number): d.DeltaStatic
    eachLine(
        predicate: (
            line: d.DeltaStatic,
            attributes: d.StringMap,
            idx: number
        ) => any,
        newline?: string
    ): d.DeltaStatic
    transform(index: number): number
    transform(other: d.DeltaStatic, priority: boolean): d.DeltaStatic
    transformPosition(index: number): number
}

declare namespace d {
    type DeltaOperation = {
        insert?: any
        delete?: number
        retain?: number
    } & OptionalAttributes

    interface Op {
        insert?: string | object
        delete?: number
        retain?: number
        attributes?: AttributeMap
    }
    namespace Op {
        function iterator(ops: DeltaOperation[]): Iterator
        function length(op: DeltaOperation): number
    }

    interface AttributeMap {
        [key: string]: any
    }
    namespace AttributeMap {
        function compose(
            a: AttributeMap | undefined,
            b: AttributeMap | undefined,
            keepNull: boolean
        ): AttributeMap | undefined
        function diff(
            a?: AttributeMap,
            b?: AttributeMap
        ): AttributeMap | undefined
        function transform(
            a: AttributeMap | undefined,
            b: AttributeMap | undefined,
            priority?: boolean
        ): AttributeMap | undefined
    }

    class Iterator {
        ops: DeltaOperation[]
        index: number
        offset: number
        constructor(ops: DeltaOperation[])
        hasNext(): boolean
        next(length?: number): DeltaOperation
        peek(): DeltaOperation
        peekLength(): number
        peekType(): string
        rest(): DeltaOperation[]
    }

    export interface StringMap {
        [key: string]: any
    }

    export interface OptionalAttributes {
        attributes?: StringMap
    }

    export interface DeltaStatic {
        ops?: DeltaOperation[]
        retain(length: number, attributes?: StringMap): DeltaStatic
        push(newOp: DeltaOperation): DeltaStatic
        delete(length: number): DeltaStatic
        filter(predicate: (op: DeltaOperation) => boolean): DeltaOperation[]
        forEach(predicate: (op: DeltaOperation, index: number) => void): void
        insert(text: any, attributes?: StringMap): DeltaStatic
        map<T>(predicate: (op: DeltaOperation) => T): T[]
        partition(
            predicate: (op: DeltaOperation) => boolean
        ): [DeltaOperation[], DeltaOperation[]]
        reduce<T>(
            predicate: (
                acc: T,
                curr: DeltaOperation,
                idx: number,
                arr: DeltaOperation[]
            ) => T,
            initial: T
        ): T
        chop(): DeltaStatic
        length(): number
        slice(start?: number, end?: number): DeltaStatic
        compose(other: DeltaStatic): DeltaStatic
        concat(other: DeltaStatic): DeltaStatic
        diff(other: DeltaStatic, index?: number): DeltaStatic
        eachLine(
            predicate: (
                line: DeltaStatic,
                attributes: StringMap,
                idx: number
            ) => any,
            newline?: string
        ): DeltaStatic
        transform(index: number): number
        transform(other: DeltaStatic, priority: boolean): DeltaStatic
        transformPosition(index: number): number
    }
}

export = d
