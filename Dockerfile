# InVision's base alpine image for node
FROM node:12.14.1-alpine

RUN apk add --no-cache --virtual .gyp python make g++

WORKDIR /srv/app

# Install node modules (allows for npm install to be cached until package.json changes)
COPY package.json .prettierrc yarn.lock tsconfig.json .npmrc .yarnrc ./
RUN yarn install

# Copy our source files to the service location
COPY . .

ARG CI_COMMIT_ID
ENV COMMIT_ID=${CI_COMMIT_ID}

# Set default environment variables
ENV \
	HOME=/tmp\
	PATH=/srv/app:/srv/app/node_modules/.bin:/bin:$PATH\
	PORT=80

RUN yarn build

# Start the server
CMD ["yarn", "start:docker"]
