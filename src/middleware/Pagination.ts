import * as joi from 'joi'
import { NextFunction, Response, Request } from 'express'

const maxLimit = 500
const defaultPage = 1

const paginationParams = joi
    .object()
    .keys({
        page: joi
            .number()
            .integer()
            .min(1),
        limit: joi
            .number()
            .integer()
            .min(1)
            .max(maxLimit)
    })
    .and('page', 'limit')

export default function pagination(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const validPagination = joi.validate(req.query, paginationParams, {
        allowUnknown: true
    })

    if (validPagination.error) {
        res.status(422).send({
            message: 'Invalid pagination parameters.'
        })
        return
    }

    const page = validPagination.value.page || defaultPage
    const limit = validPagination.value.limit || maxLimit

    req.pagination = {
        page: page,
        limit: limit,
        offset: limit * page - limit
    }

    next()
}
