declare module 'express-validation' {
    import { RequestHandler } from 'express'

    interface ValidateSchema {
        body?: { [key: string]: any }
        params?: { [key: string]: any }
        query?: { [key: string]: any }
        headers?: { [key: string]: any }
        cookies?: { [key: string]: any }
        options?: {
            allowUnknownBody?: boolean
            allowUnknownHeaders?: boolean
            allowUnknownQuery?: boolean
            allowUnknownParams?: boolean
            allowUnknownCookies?: boolean
        }
    }

    class ValidationError extends Error {
        status: number
        statusText: string
        errors: any[]
    }

    interface IValidate {
        (schema: ValidateSchema): RequestHandler
        ValidationError: typeof ValidationError
    }

    var validate: IValidate
    export = validate
}
