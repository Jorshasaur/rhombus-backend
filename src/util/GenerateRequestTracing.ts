import { RequestTracing } from '../middleware/RequestTracing'
import * as cuid from 'cuid'
import { Config } from '../config'
import { long as gitLong } from 'git-rev-sync'
const gitSha = gitLong()

export default function generateRequestTracing(): RequestTracing {
    return {
        requestId: cuid(),
        requestSource: Config.serviceName,
        outgoingCallingService: `${Config.serviceName}/${gitSha}`
    }
}
