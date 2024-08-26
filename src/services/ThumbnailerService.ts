import { FreehandHeaders } from '../interfaces/FreehandHeaders'
import { ReducedRequest } from '../interfaces/ReducedRequest'
import lambdaClient from '../lib/aws/lambdaClient'
import { Document } from '../models/Document'
import { QuillDeltaConverter } from '../util/QuillDeltaConverter'
import AssetsApiService from './AssetsApiService'

export async function createThumbnail(
    document: Document,
    request: ReducedRequest,
    headers: FreehandHeaders
) {
    const assetsApiService = new AssetsApiService()
    const assetsResponse = await assetsApiService.createAssets(
        1,
        request.invision.user.teamId,
        request.tracing
    )
    if (assetsResponse == null) {
        throw new Error('Unable to create assets in assets api')
    }
    const assetKey = assetsResponse[0].assetKey
    const assetUploadURL = assetsResponse[0].url
    const documentContents = await document.contents()
    const converter = new QuillDeltaConverter(
        request.invision.user,
        headers,
        request.tracing
    )
    const documentHTML = await converter.convert(
        document,
        documentContents.delta.ops!,
        {},
        {
            multiLineParagraph: false,
            multiLineBlockquote: false,
            multiLineHeader: false,
            multiLineCodeblock: false,
            paneTableGrid: true
        }
    )

    const html = `<div id="quill-container" class="quill-container ql-container ql-snow"><div class="ql-editor">${documentHTML}</div></div>`

    const lambdaPayload = {
        assetUploadURL,
        html,
        width: 1440,
        height: 2104,
        container: '#quill-container'
    }

    const response = await lambdaClient
        .invoke({
            FunctionName: process.env.PAGES_THUMBNAILER_FUNCTION_ARN,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(lambdaPayload)
        })
        .promise()

    const payload = JSON.parse(response.Payload)

    if (payload.success) {
        return assetKey
    }

    return null
}
