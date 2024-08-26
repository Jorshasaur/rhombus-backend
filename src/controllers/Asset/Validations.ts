import * as joi from 'joi'

export const requestUploadValidation = {
    body: {
        assets: joi
            .array()
            .items(
                joi
                    .object({
                        fileName: joi.string().required()
                    })
                    .required()
            )
            .required()
    },
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const finishUploadValidation = {
    body: {
        assetIds: joi
            .array()
            .items(
                joi
                    .string()
                    .guid()
                    .required()
            )
            .required()
    },
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const getAssetValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required(),
        assetId: joi
            .string()
            .guid()
            .required()
    }
}

export const listAssetsValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const getExternalDocumentValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required(),
        service: joi.string().required(),
        serviceAssetId: joi.string().required()
    }
}

export const getFlatPrototypeValidation = {
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    },
    query: {
        url: joi.string().required()
    }
}

export const copyAssetValidation = {
    body: {
        assetId: joi
            .string()
            .guid()
            .required()
    },
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}

export const copyAssetFromUrlValidation = {
    body: {
        assetUrl: joi.string().required()
    },
    params: {
        documentId: joi
            .string()
            .guid()
            .required()
    }
}
