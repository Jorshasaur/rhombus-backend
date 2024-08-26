declare module 'deep-object-diff' {
    /**
     * Returns the difference of the original and updated objects
     */
    export function diff<T = unknown>(originalObj: T, updatedObj: T): Partial<T>
}
