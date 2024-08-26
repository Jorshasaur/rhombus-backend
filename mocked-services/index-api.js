const { createMockedService } = require('./create-mocked-service')

const app = createMockedService('index-api')

app.get('/v1/spaces/permissions', (req, res) => {
    const { actions: actionsString, spaceIds, documentIds } = req.query
    const actions = actionsString.split(',')

    let ids
    if (spaceIds != null) {
        ids = spaceIds.split(',')
    } else if (documentIds != null) {
        ids = documentIds.split(',')
    }

    const data = ids.reduce((acc, id) => {
        acc[id] = actions.reduce((actionsAcc, action) => {
            actionsAcc[action] = {
                allow: true
            }
            return actionsAcc
        }, {})
        return acc
    }, {})

    console.log('permissions:', data)

    res.json({
        data
    })
})

module.exports = app
