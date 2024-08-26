# pages-api

![Team](https://img.shields.io/badge/team-slate-708090.svg)
![Status](https://img.shields.io/badge/status-in_development-yellow.svg)

:warning: **Please point PRs at `develop` instead of `master`.** :warning:

Pages api this domain service provides pages data to several other services.

## Service URLs

| Environment | URL |
| :-- | :-- |
| local | https://in.local.invision.works/rhombus-api |
| | |

## API Documentation

Api is documented in Swagger format - [swagger.yml](./swagger.yml)

To view more user friendly API documentation, copy contents of [swagger.yml](./swagger.yml) and paste it to left side of http://editor.swagger.io/


## Environment Variables

The following environment variables are used by this service.

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| PORT | Webserver port | 80 | 80 |
| PG_HOST | Host of the PostgreSQL database | | localhost |
| PG_DATABASE | PostgreSQL database to connect to | | postgres |
| PG_USER | User to connect to PostgreSQL database | | postgres |
| PG_PASSWORD | Password to connect to PostgreSQL database | | |
| PAGES_REDIS_HOST | Redis service host | | localhost |
| PAGES_REDIS_PORT | Redis service port | 6379 | 6379 |
| PAGES_PRESENTATIONS_API | Presentation Domain Service URL | http://presentations-api-svc | http://presentations-api-svc |
| PAGES_USERS_API | Users Domain Service URL | http://users-api-svc | http://users-api-svc |
| PAGES_ASSETS_API | Assets Service URL | http://assets-api-svc | http://assets-api-svc |
| PAGES_FREEHAND_API | Freehand API URL | http://freehand-api-v7-svc | http://freehand-api-v7-svc |
| PAGES_PROTOTYPES_API | Flat prototypes API URL | http://prototypes-api-v7-svc | http://prototypes-api-v7-svc |
| PAGES_EMAILER_API | Emailer Service URL | http://emailer-svc | http://emailer-svc |
| PAGES_API_SERVICE_NAME | Service name | pages-api | pages-api |
| | | | |

## Contributing

See the [Contributing guide](/CONTRIBUTING.md) for steps on how to contribute to this project.