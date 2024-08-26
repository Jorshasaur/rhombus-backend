const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const dotenvExpand = require('dotenv-expand')

function register() {
    const environment = process.env.ENVIRONMENT
    const isWorker = process.env.PAGES_WORKER || false

    if (!environment) {
        throw new Error('ENVIRONMENT must be defined')
    }

    const dirname = fs.realpathSync(__dirname)
    const envPath = path.resolve(dirname, 'env/', '.env')
    const topLevelEnvPath = path.resolve(dirname, '..', '.env')

    // .worker env files are only necessary for overrides. Otherwise they will use
    // the variables defined in the regular files.
    const dotenvFiles = [
        topLevelEnvPath,
        isWorker && `${envPath}.${environment}.worker`,
        `${envPath}.${environment}`,
        isWorker && `${envPath}.worker`,
        `${envPath}.base`
    ].filter(Boolean)

    // Load environment variables from .env* files. Suppress warnings using silent
    // if this file is missing. dotenv will never modify any environment variables
    // that have already been set.  Variable expansion is supported in .env files.
    // https://github.com/motdotla/dotenv
    // https://github.com/motdotla/dotenv-expand
    const parsed = {}
    dotenvFiles.forEach((dotenvFile) => {
        if (fs.existsSync(dotenvFile)) {
            const env = dotenv.config({ path: dotenvFile })
            Object.assign(parsed, dotenvExpand(env).parsed)
        }
    })
    return parsed
}

register()
