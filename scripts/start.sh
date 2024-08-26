#!/bin/sh

export ENVIRONMENT=local

concurrently -i -s all \
    -n server,worker \
    -c blue,green \
    "yarn watch ./src/index.ts" \
    "export PAGES_WORKER=true; yarn watch ./src/worker.ts"