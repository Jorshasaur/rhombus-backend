import * as joi from 'joi'

export const createDocumentValidation = {
    body: {
        title: joi.string().required(),
        spaceId: joi.string().optional()
    },
    query: {
        includeContents: joi.bool().default(false)
    }
}

export const getDocumentValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    },
    query: {
        includeContents: joi.bool().default(false),
        includeMemberships: joi.bool().default(false)
    }
}

export const getDocumentRevisionsValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const getDocumentAtRevisionValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required(),
        revision: joi.number().required()
    }
}

export const getDocumentHtmlValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const getDocumentTextValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const getDocumentThumbnailValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const archiveDocumentValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const unarchiveDocumentValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const setAccessSettingsValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    },
    body: {
        visibility: joi.number().required(),
        permissions: joi.number().required()
    }
}

export const addToMembershipsValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    },
    body: {
        members: joi
            .array()
            .items(
                joi.object({
                    userId: joi.number().required(),
                    permissions: joi.object({
                        canEdit: joi.boolean(),
                        canComment: joi.boolean()
                    })
                })
            )
            .required()
    }
}

export const updateMembershipsValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required(),
        memberId: joi.number().required()
    },
    body: {
        permissions: joi
            .object({
                canEdit: joi.boolean(),
                canComment: joi.boolean()
            })
            .required()
    }
}

export const removeFromMembershipsValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required(),
        memberId: joi.number().required()
    }
}

export const getPermissionsForDocumentsValidation = {
    query: {
        documentIds: joi
            .array()
            .items(joi.string().guid())
            .required()
    }
}

export const subscribeToDocumentValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const unsubscribeFromDocumentValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const emitGenericEventValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    },
    body: {
        event: joi.string().required()
    }
}
