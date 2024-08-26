# RUNBOOK
![Team](https://img.shields.io/badge/team-slate-lightgrey.svg)
![Status](https://img.shields.io/badge/status-in_development-yellow.svg)
[ ![Codeship Status for InVisionApp/pages-api](https://app.codeship.com/projects/d0c092a0-9cb5-0135-78c2-72ec73c1266e/status?branch=testing)](https://app.codeship.com/projects/253090)

### Team
Pages-API (Rhombus API) is owned by the Slate team.  Communication channels are:

| Channel | Description |
|---|---|
| #team-slate-core | The general Slate team channel |
| #team-slate-pr | The Slate team developer's channel |

### Technology Summary
Pages-API is built on NodeJS using Typescript.  It connects to Redis for persistent socket communications and Postgres for data storage.  The Node server runs on [Express](https://expressjs.com/).  The service runs exclusively in v7 and requires the v7 Edge Gateway in order to retrieve logged in user data.

### How to run the service
The service entry point is through `npm run start:docker`.  In the `package.json` file this is defined to start the service by registering ts-node and then calling the index file.  We aren't precompiling the Typescript files because we haven't noticed any overhead with running `ts-node` directly.

Alternately in dev mode we're calling `npm run start:local` which will start nodemon.

### Dependencies

| Service  | Description   |
|---|---|
| Postgres  | We're using Postgres to store Document and Membership data  |
| Redis  | Redis is being used for scaling with Socket IO to make persistant socket connections across nodes.  |
|  Users API | Users API is being used to pull back details on users related to document membership  |

### Testing
Tests are written using Jest, Chai, and Sinon.  To execute the tests on an `invision-local` environment run `npm in-test`.  Inside the container the test command to run is `npm test`.

### Logging
The repo uses [invision-nodejs-logger](https://github.com/InVisionApp/invision-nodejs-logger) to format logs for Datadog.

Important logs on Datadog are:

| Title | Link | Description |
|---|---|---|
| TBD | TBD | TBD |

The service also uses New Relic which should only run on production builds.  The New Relic app name for the deployed service should be found under `pages-api-<CLUSTER NAME>`.  If local reporting is enabled that dashboard should be `Rhombus API Local`.

### Feature Flags

| Flag Name | Description |
|---|---|
| `Rhombus: SLATE-158 - Enable API` | When set to true this flag will enable the Rhombus API. |
| `Rhombus: SLATE-158 - Has Access` | A flag to selectively give users access to the Rhombus API. |
