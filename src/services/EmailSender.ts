import { User } from '../interfaces/User'
import EmailerApiService, {
    EmailTemplateType,
    EmailTemplateVariables
} from './EmailerApiService'
import { ReducedRequest } from '../interfaces/ReducedRequest'

export interface EmailTemplate {
    type: EmailTemplateType
    from: string
    recipients: User[]
    subject: string
    templateVariables: EmailTemplateVariables
}

export function getTemplateDataForUsers(
    users: User[],
    from: string,
    subject: string,
    templateVariables: EmailTemplateVariables
) {
    return users.map((user) => {
        return {
            from,
            to: user.email,
            subject,
            templateVariables
        }
    })
}

export function send(template: EmailTemplate, request: ReducedRequest) {
    const data = getTemplateDataForUsers(
        template.recipients,
        template.from,
        template.subject,
        template.templateVariables
    )
    const emailerApiService = new EmailerApiService(request)

    return emailerApiService.batchSendTemplate(
        template.type,
        data,
        request.tracing
    )
}
