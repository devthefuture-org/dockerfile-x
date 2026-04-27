# syntax=docker/dockerfile:1
############################################################
# 1) Base Node environment
############################################################
FROM node:18 AS node-base

# Create non-root workspace owned by uid/gid 1000 (keeps permissions consistent across stages)
RUN mkdir /app && chown 1000:1000 /app
USER 1000
WORKDIR /app

############################################################
# 2) Dependency layer (Yarn cache prefetch)
############################################################
FROM node-base AS deps
ARG TARGETARCH

# Copy only Yarn config + lockfile up front to maximize layer caching
COPY --link --chown=1000:1000 .yarnrc.yml yarn.lock ./
COPY --link --chown=1000:1000 .yarn .yarn

# Pre-fetch Yarn cache without installing (fast, deterministic, cacheable)
# NOTE: BuildKit cache mount keeps the artifact cache across builds.
RUN yarn fetch

# Normalize Docker's TARGETARCH into Node's arch names and persist for later stages
# amd64 -> x64, arm -> armv7, otherwise pass through (arm64, etc.)
RUN bash -lc 'case "$TARGETARCH" in \
  amd64) echo x64 ;; \
  arm)   echo armv7 ;; \
  *)     echo "$TARGETARCH" ;; \
esac > .nodearch'

############################################################
# 3) CLI build (bundle with ncc, pack with vercel/pkg)
############################################################
FROM deps AS build-cli

# Prefetch the Node runtime that "pkg" will embed so the next step is faster and stable
# (See: https://github.com/vercel/pkg/issues/292#issuecomment-401353635)
RUN touch noop.js && \
    yarn pkg -t node18-linuxstatic-$(cat .nodearch) noop.js --out=noop && \
    rm -rf noop noop.js

# Copy the minimum project sources necessary for building the CLI
COPY --link --chown=1000:1000 src ./src
COPY --link --chown=1000:1000 index.js package.json ./

# Build the CLI (ncc) and then produce a single-file static binary via pkg
RUN yarn build:ncc && \
    yarn pkg -t node18-linuxstatic-$(cat .nodearch) \
      -o ./dist-bin/dockerfile-x --compress=GZip ./dist/index.js

############################################################
# 4) Build Go frontend (static binary)
############################################################
FROM golang:1.25 AS build-frontend
ARG TARGETARCH
WORKDIR /app

# Copy modules first for better caching, then the sources
COPY --link go.mod go.sum  ./
COPY --link vendor         ./vendor
COPY --link pkg            ./pkg
COPY --link main.go        ./

# Produce a fully-static Linux binary (no CGO, strip symbols)
# GOARCH is derived from Docker's --platform
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH \
    go build -mod=vendor -trimpath -buildvcs=false \
    -ldflags='-s -w -extldflags "-static"' \
    -o dist-bin/dockerfile-x-frontend .

############################################################
# 5) Fetch oras (static binary, used to pull OCI artifacts)
############################################################
FROM alpine:3 AS oras-bin
ARG TARGETARCH
ARG ORAS_VERSION=1.2.3
RUN apk add --no-cache curl tar \
 && case "$TARGETARCH" in \
      amd64) ORAS_ARCH=amd64 ;; \
      arm64) ORAS_ARCH=arm64 ;; \
      *)     echo "unsupported arch $TARGETARCH" && exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/oras-project/oras/releases/download/v${ORAS_VERSION}/oras_${ORAS_VERSION}_linux_${ORAS_ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin oras \
 && chmod +x /usr/local/bin/oras

############################################################
# 6) Final image — alpine + git + oras + credential helpers
############################################################
FROM alpine:3

# BuildKit frontend capabilities (mirrors upstream Dockerfile frontend).
# The `network.none` capability is intentionally NOT declared: the frontend
# fetches HTTP/Git/OCI sources at compile time and needs network access.
LABEL moby.buildkit.frontend.caps="moby.buildkit.frontend.inputs,moby.buildkit.frontend.subrequests,moby.buildkit.frontend.contexts"

# Runtime deps:
#   - ca-certificates: TLS root store for axios (HTTP includes) and oras
#   - git: sparse fetch for git+ includes
#   - bash: convenience for credential-helper scripts
# Cloud credential helpers are added as static binaries.
# Other helpers (gcr, acr, etc.) can be installed in a derived image.
# curl is installed in a virtual package and removed after use — it's only
# needed at build time to fetch the ECR helper, not at runtime.
ARG TARGETARCH
ARG AWS_ECR_LOGIN_VERSION=0.9.1
RUN apk add --no-cache \
        ca-certificates \
        git \
        bash \
 && apk add --no-cache --virtual .build-deps curl \
 && case "$TARGETARCH" in \
      amd64) ECR_ARCH=linux-amd64 ;; \
      arm64) ECR_ARCH=linux-arm64 ;; \
      *)     ECR_ARCH="" ;; \
    esac \
 && if [ -n "$ECR_ARCH" ]; then \
      curl -fsSL "https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/${AWS_ECR_LOGIN_VERSION}/${ECR_ARCH}/docker-credential-ecr-login" \
        -o /usr/local/bin/docker-credential-ecr-login \
      && chmod +x /usr/local/bin/docker-credential-ecr-login; \
    fi \
 && apk del .build-deps

# Add a writeable workspace and run as non-root
RUN adduser -D -u 1000 dockerfile-x && mkdir -p /workspace && chown 1000:1000 /workspace
ENV DOCKERFILEX_TMPDIR=/workspace
USER 1000
WORKDIR /workspace

# Runtime artifacts
COPY --link --from=oras-bin       /usr/local/bin/oras /usr/local/bin/oras
COPY --link --from=build-frontend /app/dist-bin/ /usr/local/bin/
COPY --link --from=build-cli      /app/dist-bin/ /usr/local/bin/

ENTRYPOINT ["/usr/local/bin/dockerfile-x-frontend"]