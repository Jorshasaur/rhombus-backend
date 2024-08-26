#!/bin/sh

export ENVIRONMENT=local

concurrently -i -s all \
    -n inv,mocks,server,worker \
    -c teal,gray,blue,green \
    "cd ../invision-local && docker-compose start postgres-96 redis-32" \
    "./scripts/start-mock-services.sh" \
    "yarn watch ./src/index.ts" \
    "export PAGES_WORKER=true; yarn watch ./src/worker.ts"