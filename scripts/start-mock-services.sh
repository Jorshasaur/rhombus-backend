#!/bin/sh

export ENVIRONMENT=local

concurrently -i -s all \
    -n assets,emailer,freehand,index,presentations,prototypes,users \
    "node -r ./config/env ./mocked-services/assets-api.js" \
    "node -r ./config/env ./mocked-services/emailer-api.js" \
    "node -r ./config/env ./mocked-services/freehand-api.js" \
    "node -r ./config/env ./mocked-services/index-api.js" \
    "node -r ./config/env ./mocked-services/presentations-api.js" \
    "node -r ./config/env ./mocked-services/prototypes-api.js" \
    "node -r ./config/env ./mocked-services/users-api.js"
