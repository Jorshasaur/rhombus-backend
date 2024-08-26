import * as LaunchDarkly from 'launchdarkly-node-server-sdk'
import { Logger } from './Logger'

/**
 * The idea here is that Launch Darkly should never break anything, which
 * is why I'm always returning a resolve on the feature flag promises even
 * if there is an error.  In those cases I'm logging the problem and returning
 * a false (which I'm assuming is the default behavior).
 *
 * The LaunchDarklyHelper is a singleton class because Launch Darkly
 * asks that we only instantiate their SDK once.  And because the SDK
 * handles its own caching this should increase performance.
 *
 * See https://docs.launchdarkly.com/docs/node-sdk-reference
 */
export class LaunchDarklyHelper {
    // Feature Flag Strings
    public static readonly HAS_ACCESS = 'rhombus-slate-158-has-access'
    public static readonly DOCUMENT_HISTORY_COMBINATION_METRICS =
        'rhombus-document-history-combination-metrics'
    private static instance: LaunchDarklyHelper

    private ldClient: LaunchDarkly.LDClient
    private logger: Logger
    private cluster: string
    private isReady: boolean = false

    public static getInstance() {
        if (this.instance === null || this.instance === undefined) {
            this.instance = new LaunchDarklyHelper()
        }
        return this.instance
    }

    private constructor() {
        this.logger = Logger
        this.cluster = process.env.LAUNCH_DARKLY_USER || ''
    }

    /**
     * Connect is necessary before any other calls can be made to Launch Darkly.  Calls made before the client
     * has connected will return the default false state.
     */
    public connect() {
        try {
            this.logger.debug('Connecting to Launch Darkly client')
            this.ldClient = LaunchDarkly.init(
                process.env.LAUNCH_DARKLY_API_KEY || ''
            )
            this.ldClient.on('ready', () => {
                this.isReady = true
            })
        } catch (e) {
            this.isReady = false
            this.logger.error(
                'Unable to connect to Launch Darkly, all flags will be served as false',
                { launch_darkly_error: e }
            )
        }
    }

    /**
     * This is needed for workers trying to use LaunchDarkly in a separate process.
     * If we can't wait for the connection, all LD calls in that worker will fail
     */
    public async waitForConnect() {
        return new Promise((resolve, reject) => {
            if (!this.isReady) {
                let timeout = setTimeout(
                    () => reject('Launch Darkly connection timeout'),
                    10000
                )
                this.ldClient.on('ready', () => {
                    clearTimeout(timeout)
                    resolve()
                })
            } else {
                resolve()
            }
        })
    }

    /**
     * This call gets a non-targeted feature flag.  Useful in those cases where you want to treat
     * everyone the same and you don't care about who they are.
     * @param featureFlag
     */
    public async getFeatureFlag(
        featureFlag: string,
        defaultValue: any = false
    ) {
        if (!this.isReady || !this.ldClient) {
            this.logger.debug(
                `Returning false to feature flag request: ${featureFlag} because LD isn't ready`
            )
            return false
        }
        return this.ldClient
            .variation(
                featureFlag,
                { key: this.cluster + '1234' },
                defaultValue
            )
            .catch((err) => {
                const message = `Error getting ${featureFlag} from Launch Darkly`
                this.logger.error({ err }, message)
                throw new Error(message)
            })
    }

    private async getFeatureFlagBy(
        featureFlag: string,
        user: LaunchDarkly.LDUser,
        defaultValue: any = false
    ) {
        if (!this.isReady || !this.ldClient) {
            this.logger.debug(
                `Returning false to feature flag request: ${featureFlag} because LD isn't ready`
            )
            return false
        }
        return this.ldClient
            .variation(featureFlag, user, defaultValue)
            .catch((err) => {
                const message = `Error getting ${featureFlag} for user ${JSON.stringify(
                    user
                )} from Launch Darkly on ${this.cluster}`
                this.logger.error({ err }, message)
                throw new Error(message)
            })
    }

    /**
     * This call lets you specifically target a user who's been added or excluded from the Launch Darkly
     * site.  The key we're using is email.
     * @param featureFlag
     * @param email - Because different PC users could share user id's, we should assume that emails are a better unique identifier
     */
    public async getFeatureFlagByUser(featureFlag: string, email: string) {
        return this.getFeatureFlagBy(featureFlag, { key: this.cluster + email })
    }

    public async getFeatureFlagByUserAndTeamId(
        featureFlag: string,
        email: string,
        teamId: string,
        defaultValue: any = false
    ) {
        return this.getFeatureFlagBy(
            featureFlag,
            {
                key: this.cluster + email,
                custom: { teamId }
            },
            defaultValue
        )
    }
}
