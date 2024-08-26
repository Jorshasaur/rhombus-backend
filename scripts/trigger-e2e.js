const Codeship = require('codeship-js')
const CODESHIP_ORGANIZATION = 'invisionapp'
const E2E_TESTS_CODESHIP_PROJECT_UUID = '5c41f770-3ff0-0136-2538-2ab6f06869e9'
const E2E_MULTIUSER_TESTS_CODESHIP_PROJECT_UUID = 'c496a1b0-fca7-0136-86cf-22aabc7c0f09'

function latestBuild(builds, ref) {
    for (build of builds) {
        if (build.finished_at === null) {
            return
        }

        if (build.ref === ref) {
            return build
        }
    }
}

async function triggerBuild(organization, projectUUID, name) {
    const builds = await organization.listBuilds(projectUUID)
    const build = latestBuild(builds, 'heads/master')

    if (build) {
        console.log(`Triggering ${name} build`)
        await organization.restartBuild(projectUUID, build.uuid)
    }
}

async function main() {
    const codeshipClient = new Codeship(process.env.CODESHIP_USERNAME, process.env.CODESHIP_PASSWORD)
    await codeshipClient.auth()

    const organization = codeshipClient.organization(CODESHIP_ORGANIZATION)

    await triggerBuild(organization, E2E_TESTS_CODESHIP_PROJECT_UUID, 'e2e')
    await triggerBuild(organization, E2E_MULTIUSER_TESTS_CODESHIP_PROJECT_UUID, 'multiuser-e2e')
}

main()