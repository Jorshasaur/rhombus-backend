import { Operation } from './Operation'
import { ReducedRequest } from './ReducedRequest'
import { FreehandHeaders } from './FreehandHeaders'

interface RevisionType {
    getOperation(): Object
    runAfterSubmitHooks(
        userId: number,
        vendorId: string,
        req: ReducedRequest,
        headers: FreehandHeaders,
        documentId?: string
    ): void
}

export interface Revision {
    checkForSubmittedRevision(
        userId: number,
        operation: Operation
    ): Promise<boolean>
    new (): RevisionType
}

export function StaticImplements<T>() {
    return <U extends T>(constructor: U) => {
        constructor
    }
}
