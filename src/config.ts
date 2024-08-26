enum Environments {
    LOCAL = 'local-cluster',
    INTEGRATION = 'use1-test-4-integration-v7-cluster',
    PREVIEW = 'use1-prev-1-v7-cluster',
    MT = 'use1-prod-1-v7-cluster'
}

const isLiveRhombusEnv = () => {
    const env = process.env.METADATA_NAME
    return env === Environments.INTEGRATION || env === Environments.MT
}

const Config = {
    assetsApi: process.env.PAGES_ASSETS_API,
    freehandApi: process.env.PAGES_FREEHAND_API,
    prototypesApi: process.env.PAGES_PROTOTYPES_API,
    emailerApi: process.env.PAGES_EMAILER_API,
    nodeEnv: process.env.NODE_ENV || 'development',
    prettyLogging: process.env.PRETTY_LOGGING === 'true',
    environment: process.env.ENVIRONMENT,
    pg: {
        database: process.env.POSTGRES_DATABASE,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT || 5432,
        poolSize: process.env.PG_POOL_SIZE || 10,
        poolMin: process.env.PG_POOL_MIN || 10,
        workerPoolSize: process.env.PG_WORKER_POOL_SIZE || 1,
        workerPollMinSize: process.env.PG_WORKER_POOL_MIN_SIZE || 1,
        // PG timeout is expressed in Milliseconds
        timeout: process.env.PG_TIMEOUT || 10000,
        workerTimeout: process.env.PG_WORKER_TIMEOUT || 10000
    },
    redis: {
        host: process.env.PAGES_API_REDIS_HOST,
        port: process.env.PAGES_REDIS_PORT as number | undefined
    },
    port: process.env.PORT,
    presentationsApi: process.env.PAGES_PRESENTATIONS_API,
    usersApi: process.env.PAGES_USERS_API,
    serviceName: process.env.PAGES_API_SERVICE_NAME || 'rhombus-api',
    pagesBasePath: '/rhombus',
    statsd: {
        host: process.env.STATSD_HOST || 'statsd-svc.default',
        port: process.env.STATSD_PORT ? +process.env.STATSD_PORT! : 8125,
        prefix: process.env.STATSD_PREFIX || ''
    },
    metadataType: process.env.METADATA_TYPE || 'unknown',
    metadataName: process.env.METADATA_NAME || '',
    bugsnagKey: process.env.BUGSNAG_KEY || '',
    bugsnagEnabled: process.env.METADATA_TYPE !== 'local',
    debugSockets: process.env.NODE_ENV === 'production' ? false : false,
    enableLD: !(
        process.env.NODE_ENV === 'development' &&
        process.env.DISABLE_LD === 'true'
    ),
    senderEmail: 'no-reply@invisionapp.com',
    indexApi: process.env.PAGES_INDEX_API,
    segmentApiKey: process.env.SEGMENT_V7_WRITE_KEY,
    queueName: 'pages-api-queue',
    lightStep: {
        token: process.env.LIGHTSTEP_ACCESS_TOKEN,
        host: process.env.LIGHTSTEP_HOST,
        port: process.env.LIGHTSTEP_PORT,
        protocol: process.env.LIGHTSTEP_PROTOCOL
    },
    logLevel: process.env.LOG_LEVEL || 'debug',
    eventBus: {
        namespacePrefix: process.env.EVENTBUS_NAMESPACE_PREFIX!,
        topic: process.env.EVENTBUS_DEFAULT_OUTBOUND_TOPIC!,
        topicFreehandApiOut: process.env.EB_TOPIC_FREEHANDAPI_OUT
    },
    isEnabled:
        process.env.METADATA_NAME === Environments.LOCAL ||
        process.env.METADATA_NAME === Environments.INTEGRATION ||
        process.env.METADATA_NAME === Environments.PREVIEW ||
        process.env.METADATA_NAME === Environments.MT,
    cdn: 'https://invisionapp-cdn.com',
    worker: {
        port: process.env.WORKER_PORT || 80
    }
}
export { Config, Environments, isLiveRhombusEnv }
