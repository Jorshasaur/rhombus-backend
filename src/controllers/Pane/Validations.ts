import * as joi from 'joi'

export const createPaneValidation = {
    body: {
        title: joi.string().optional(),
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const revisionsSinceRevisionValidation = {
    params: {
        paneId: joi
            .string()
            .guid()
            .required(),
        revision: joi.number().required()
    }
}

export const getPanesValidation = {
    query: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const getPaneValidation = {
    params: {
        paneId: joi
            .string()
            .guid()
            .required()
    }
}

export const duplicatePaneValidation = {
    body: {
        documentId: joi
            .string()
            .guid()
            .required()
    },
    params: {
        paneId: joi
            .string()
            .guid()
            .required()
    }
}
