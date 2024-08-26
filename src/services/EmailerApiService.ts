import { Config } from '../config'
import { AxiosError } from 'axios'
import { RequestTracing } from '../middleware/RequestTracing'
import { getOutgoingHeaders } from './utils'
import DomainService from './DomainService'
import { ReducedRequest } from '../interfaces/ReducedRequest'

export interface EmailTemplateVariables {
    [key: string]: any
}

export interface EmailTemplateData {
    from: string
    to: string
    subject: string
    templateVariables: EmailTemplateVariables
}

export enum EmailTemplateType {
    RhombusDocumentUpdates = 'rhombus-document-updates',
    RhombusMentionNotification = 'rhombus-mention-notification'
}

interface SendTemplateResponse {
    ErrorCode: number
    Message: string
}

interface BatchSendTemplateResponse {
    emails: SendTemplateResponse[]
}

export default class EmailerApiService extends DomainService {
    constructor(req?: ReducedRequest) {
        super(req)
        this.serviceName = 'emailer-api'
    }

    public async sendTemplate(
        templateName: EmailTemplateType,
        templateData: EmailTemplateData,
        requestTracing: RequestTracing
    ): Promise<SendTemplateResponse | void> {
        this.track('sendTemplate')
        const requestData = this.transformTemplateData(templateData)

        const response = await this.axios
            .post<SendTemplateResponse>(
                `/v1/templates/${templateName}`,
                requestData,
                {
                    headers: getOutgoingHeaders(requestTracing),
                    baseURL: Config.emailerApi
                }
            )
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data
        }
    }

    public async batchSendTemplate(
        templateName: EmailTemplateType,
        templateData: EmailTemplateData[],
        requestTracing: RequestTracing
    ): Promise<SendTemplateResponse[] | void> {
        this.track('batchSendTemplate')
        const requestData = {
            emails: templateData.map(this.transformTemplateData)
        }

        const response = await this.axios
            .post<BatchSendTemplateResponse>(
                `/v1/templates/${templateName}/batch`,
                requestData,
                {
                    headers: getOutgoingHeaders(requestTracing),
                    baseURL: Config.emailerApi
                }
            )
            .catch((error: AxiosError) => {
                this.logError(error)
            })

        if (response) {
            return response.data.emails
        }
    }

    private transformTemplateData(templateData: EmailTemplateData) {
        return {
            From: templateData.from,
            To: templateData.to,
            Subject: templateData.subject,
            templateVariables: templateData.templateVariables
        }
    }
}
