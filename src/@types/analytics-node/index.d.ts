// Type definitions for Segment's analytics.js for Node.js
// Project: https://segment.com/docs/libraries/node/
// Definitions by: Andrew Fong <https://github.com/fongandrew>
//                 Thomas Thiebaud <https://github.com/thomasthiebaud>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// @todo analytics-node from DefinitelyTyped was failing so we need to have modified version inside project src/@types
// we can remove it once analytics-node from DefinitelyTyped will be fixed
// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/23760

declare class a {
    constructor(
        writeKey: string,
        opts?: {
            flushAt?: number
            flushAfter?: number
            host?: string
            enable?: boolean
        }
    )

    /* The identify method lets you tie a user to their actions and record
     traits about them. */
    identify(
        message: {
            userId: string | number
            traits?: Object
            timestamp?: Date
            context?: Object
            integrations?: a.Integrations
        },
        callback?: (err: Error, data: a.Data) => void
    ): this

    /* The track method lets you record the actions your users perform. */
    track(
        message: {
            userId: string | number
            event: string
            properties?: Object
            timestamp?: Date
            context?: Object
            integrations?: a.Integrations
        },
        callback?: (err: Error, data: a.Data) => void
    ): this

    /* The page method lets you record page views on your website, along with
     optional extra information about the page being viewed. */
    page(
        message: {
            userId: string | number
            category?: string
            name?: string
            properties?: Object
            timestamp?: Date
            context?: Object
            integrations?: a.Integrations
        },
        callback?: (err: Error, data: a.Data) => void
    ): this

    /* alias is how you associate one identity with another. */
    alias(
        message: {
            previousId: string | number
            userId: string | number
            integrations?: a.Integrations
        },
        callback?: (err: Error, data: a.Data) => void
    ): this

    /* Group calls can be used to associate individual users with shared
     accounts or companies. */
    group(
        message: {
            userId: string | number
            groupId: string | number
            traits?: Object
            context?: Object
            timestamp?: Date
            anonymous_id?: string | number
            integrations?: a.Integrations
        },
        callback?: (err: Error, data: a.Data) => void
    ): this

    /* Flush batched calls to make sure nothing is left in the queue */
    flush(callback?: (err: Error, data: a.Data) => void): this
}

declare namespace a {
    export interface Message {
        type: string
        context: {
            library: {
                name: string
                version: string
            }
            [key: string]: any
        }
        _metadata: {
            nodeVersion: string
            [key: string]: any
        }
        timestamp?: Date
        messageId?: string
        anonymousId: string | number
        userId: string | number
    }

    export interface Data {
        batch: Message[]
        timestamp: Date
        sentAt: Date
    }

    export interface Integrations {
        [index: string]: boolean
    }
}

export = a
