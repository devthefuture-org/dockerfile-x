FROM node:18 AS node

RUN mkdir /app && chown 1000:1000 /app
USER 1000
WORKDIR /app

FROM node AS build

COPY  --chown=1000:1000 .yarnrc.yml yarn.lock ./
COPY  --chown=1000:1000 .yarn .yarn
RUN yarn fetch

RUN npx pkg-fetch --platform=linux --node-range=node18 && \
  npx pkg-fetch --platform=linuxstatic --node-range=node18

COPY --chown=1000:1000 . .
RUN yarn build

FROM scratch
ENTRYPOINT [ "/dockerfile-x" ]
COPY --from=build /app/dist-bin/dockerfile-x /