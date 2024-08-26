import EmailerApiService, {
    EmailTemplateType
} from '../../../services/EmailerApiService'

describe('EmailApiService', () => {
    it('should send template', async () => {
        const requestTracing = {
            requestId: '1',
            requestSource: 'test',
            outgoingCallingService: 'pages-api'
        }

        const emailerApiService = new EmailerApiService()
        emailerApiService.axios.post = jest.fn(() => {
            return Promise.resolve({})
        })

        const templateName = EmailTemplateType.RhombusMentionNotification
        const templateData = {
            from: 'no-reply@invisionapp.com',
            to: 'test@invisionapp.com',
            subject: 'subject',
            templateVariables: {
                test: '1'
            }
        }
        await emailerApiService.sendTemplate(
            templateName,
            templateData,
            requestTracing
        )

        expect(emailerApiService.axios.post).toBeCalledWith(
            `/v1/templates/${EmailTemplateType.RhombusMentionNotification}`,
            {
                From: templateData.from,
                Subject: templateData.subject,
                To: templateData.to,
                templateVariables: templateData.templateVariables
            },
            expect.anything()
        )
    })

    it('should batch send template', async () => {
        const requestTracing = {
            requestId: '1',
            requestSource: 'test',
            outgoingCallingService: 'pages-api'
        }

        const emailerApiService = new EmailerApiService()
        emailerApiService.axios.post = jest.fn(() => {
            return Promise.resolve({ data: { emails: [] } })
        })

        const templateName = EmailTemplateType.RhombusMentionNotification
        const templateData = {
            from: 'no-reply@invisionapp.com',
            to: 'test@invisionapp.com',
            subject: 'subject',
            templateVariables: {
                test: '1'
            }
        }
        await emailerApiService.batchSendTemplate(
            templateName,
            [templateData],
            requestTracing
        )

        expect(emailerApiService.axios.post).toBeCalledWith(
            `/v1/templates/${EmailTemplateType.RhombusMentionNotification}/batch`,
            {
                emails: [
                    {
                        From: templateData.from,
                        Subject: templateData.subject,
                        To: templateData.to,
                        templateVariables: templateData.templateVariables
                    }
                ]
            },
            expect.anything()
        )
    })
})
