const express = require('express')
const _ = require('lodash/fp')

function createMockedService(name) {
    const app = express()
    const port = process.env[`${_.pipe(_.snakeCase, _.toUpper)(name)}_PORT`]

    app.use((req, res, next) => {
        console.log(req.originalUrl)
        next()
    })
    app.get('/', (req, res) => res.send(`${name} mock!`))

    app.listen(port, () => console.log(`${name} listening on port ${port}!`))

    return app
}

module.exports = {
    createMockedService
}
