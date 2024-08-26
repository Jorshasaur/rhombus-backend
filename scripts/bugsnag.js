const reportBuild = require('bugsnag-build-reporter')
const { upload } = require('bugsnag-sourcemaps')
const path = require('path')
const fs = require('fs')

async function main() {
    if (process.env.CI) {
        const buildJSPath = path.resolve(path.join(__dirname, '../build'))

        // report build
        const reportBuildOptions = {
            apiKey: process.env.BUGSNAG_KEY,
            appVersion: process.env.CI_COMMIT_ID,
            sourceControl: {
                provider: 'github',
                repository: 'https://github.com/InVisionApp/pages-api',
                revision: process.env.CI_COMMIT_ID
            }
        }
        await reportBuild(reportBuildOptions, {
            /* opts */
        })
            .then(() => console.log('Bugsnag - report build success!'))
            .catch((err) =>
                console.log('Bugsnag - report build  fail', err.messsage)
            )

        // upload source map
        const uploadSourcemapOptions = {
            ...reportBuildOptions,
            overwrite: true,
            directory: buildJSPath,
            // uploadSources: true,
            projectRoot: path.resolve(path.join(__dirname, '../'))
        }

        console.log('----------')
        console.log('Uploading sourcemaps with the following options:')
        console.log(uploadSourcemapOptions)

        upload(uploadSourcemapOptions, function(err) {
            if (err) {
                throw new Error(
                    'Bugsnag - sourcemap upload  fail' + JSON.stringify(err)
                )
            } else {
                console.log('Bugsnag - sourcemap was uploaded successfully.')
            }
        })
    }
}

main()
