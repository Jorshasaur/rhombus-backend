import * as sinon from 'sinon'
import { FreehandHeaders } from '../../../interfaces/FreehandHeaders'
import {
    getReducedRequestFromRequest,
    ReducedRequest
} from '../../../interfaces/ReducedRequest'
import lambdaClient from '../../../lib/aws/lambdaClient'
import AssetsApiService from '../../../services/AssetsApiService'
import { createThumbnail } from '../../../services/ThumbnailerService'
import { QuillDeltaConverter } from '../../../util/QuillDeltaConverter'
import { RequestResponseMock } from '../../utils'

describe('ThumbnailerService', () => {
    let sandbox = sinon.createSandbox()

    it('should create a thumbnail for a document', async () => {
        const assetKey = 'test-asset-key'
        const url = 'asset.key.url'
        const document = {
            contents: jest.fn(() => {
                return {
                    delta: {
                        ops: ''
                    }
                }
            })
        } as any

        let req = new RequestResponseMock().request

        let freehandHeaders: FreehandHeaders = {
            ip: '',
            userAgent: '',
            hostname: 'in.local.invision.works'
        }

        let reducedRequest: ReducedRequest = getReducedRequestFromRequest(req)

        const html = "<b>Here's some html</b>"

        sandbox.stub(AssetsApiService.prototype, 'createAssets').returns([
            {
                assetKey,
                url
            }
        ])

        lambdaClient.invoke = jest.fn(() => {
            return {
                promise: jest.fn(() => {
                    return {
                        Payload: '{"success": true}'
                    }
                })
            }
        })

        sandbox.stub(QuillDeltaConverter.prototype, 'convert').returns(html)

        const thumbnailResponse = await createThumbnail(
            document,
            reducedRequest,
            freehandHeaders
        )

        const lambdaPayload = {
            assetUploadURL: url,
            html: `<div id="quill-container" class="quill-container ql-container ql-snow"><div class="ql-editor">${html}</div></div>`,
            width: 1440,
            height: 2104,
            container: '#quill-container'
        }

        expect(lambdaClient.invoke).toHaveBeenCalledWith({
            FunctionName: process.env.PAGES_THUMBNAILER_FUNCTION_ARN,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(lambdaPayload)
        })

        expect(thumbnailResponse).toBe(assetKey)
    })
})
