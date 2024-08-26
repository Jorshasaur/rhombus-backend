import * as joi from 'joi'

export const getTeamDocumentsValidation = {
    params: {
        teamId: joi.string().required()
    },
    query: {
        documentIds: [joi.string(), joi.array().items(joi.string().required())],
        isArchived: joi.boolean().default(false),
        includeThumbnails: joi.boolean().default(false)
    }
}
