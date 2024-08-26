import * as joi from 'joi'

export const getPermissionsValidation = {
    query: {
        document_ids: joi
            .alternatives()
            .try(joi.string(), joi.array().items(joi.string().required()))
            .required(),
        actions: joi.string().required()
    }
}
