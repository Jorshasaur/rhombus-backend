interface DeepEqualOptions {
    strict: boolean
}
declare module 'deep-equal' {
    interface IEqual {
        (actual: any, expected: any, opts?: DeepEqualOptions): boolean
    }

    var equal: IEqual
    export = equal
}
