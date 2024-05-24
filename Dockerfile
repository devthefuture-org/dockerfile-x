FROM node:18 AS node

RUN mkdir /app && chown 1000:1000 /app
USER 1000
WORKDIR /app

FROM node AS build-cli
ARG TARGETARCH

COPY .yarnrc.yml yarn.lock ./
COPY --chown=1000:1000 .yarn .yarn
RUN yarn fetch

RUN NODE_ARCH=$(if [ "$TARGETARCH" = "amd64" ]; then echo "x64"; elif [ "$TARGETARCH" = "arm" ]; then echo "armv7"; else echo "$TARGETARCH"; fi) && \
  echo $NODE_ARCH>.nodearch

# prefetch node, see https://github.com/vercel/pkg/issues/292#issuecomment-401353635
RUN touch noop.js && \
  yarn pkg -t node18-linuxstatic-$(cat .nodearch) noop.js --out=noop && rm -rf noop && \
  rm noop.js

COPY package.json index.js ./
COPY src src
RUN yarn build:ncc
RUN yarn pkg -t node18-linuxstatic-$(cat .nodearch) -o ./dist-bin/dockerfile-x --compress=GZip ./dist/index.js

FROM alpine:3 as certs
RUN apk --update add ca-certificates

FROM golang:1.21 AS build-frontend
ARG TARGETARCH
WORKDIR /app
COPY vendor vendor
COPY go.mod go.sum ./
COPY pkg pkg
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -mod vendor -ldflags '-w -extldflags "-static"' -o dist-bin/dockerfile-x-frontend .

FROM scratch

# see https://github.com/moby/buildkit/blob/master/frontend/dockerfile/cmd/dockerfile-frontend/Dockerfile
LABEL moby.buildkit.frontend.network.none="true"
LABEL moby.buildkit.frontend.caps="moby.buildkit.frontend.inputs,moby.buildkit.frontend.subrequests,moby.buildkit.frontend.contexts"

ENTRYPOINT [ "/dockerfile-x-frontend" ]
ENV PATH=/
ENV DOCKERFILEX_TMPDIR=/workspace
USER 1000
WORKDIR /workspace
COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build-frontend /app/dist-bin/ /
COPY --from=build-cli /app/dist-bin/ /