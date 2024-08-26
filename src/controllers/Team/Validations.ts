import * as joi from 'joi'

export const getTeamDocumentsValidation = {
    params: {
        teamId: joi.string().required()
    },
    query: {
        documentIds: [joi.string(), joi.array().items(joi.string().required())],
        isArchived: joi.boolean().default(false)
    }
}

export const getUserDocumentsValidation = {
    params: {
        teamId: joi.string().required(),
        userId: joi.string().required()
    },
    query: {
        isArchived: joi.boolean().default(false)
    }
}
