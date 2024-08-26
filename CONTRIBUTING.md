# Contributing

## Local Development

### Base Requirements

-   [Node.js](https://nodejs.org/en/)
-   [yarn](https://yarnpkg.com)

### Get up and running

1. Setup V7 Local Environment - https://github.com/InVisionApp/invision-local

2. Disable the non-development version of pages-api

```sh
docker-compose stop pages-api
docker-compose rm -f pages-api
./utils/edgeconfig-util service pages-api --local=$WORKING_DIR/pages-api/in-config.yaml -d
```

3. Clone `pages-api`

```
git clone git@github.com:InVisionApp/pages-api.git
cd pages-api
```

4. Build and start for development

```sh
# This is a super lightweight way to spin up the service, good for
# working on APIs or when you're just running it locally to develop
# pages-web or pages-ui against it. We mock out upstream services
# with this option.
yarn start:local
# This spins up the service against real upstream services. It's
# much slower but it's better when you need actual permissions, an actual freehand service running, etc.
docker-compose up
```

### Creating a feature branch

When you're starting a feature you should first make a branch off the `develop` branch. Pull requests are automatically posted into the Rhombus PR channel and someone on the team will review the code. Once the code has been approved you should do a `Create a pull request` from Github, all PR's should point to the `develop` branch.

_NOTE: Once your PR has been approved, a Rhombus squad member will merge the PR into `develop` and we will handle creating the release PR to production. **If at any point you are unsure of what will be deployed please reach out to `@slate-eng` on Slack**._
