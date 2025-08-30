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
# 4) CA certificates for final scratch
############################################################
FROM alpine:3 AS certs
RUN apk --no-cache add ca-certificates

############################################################
# 5) Build Go frontend (static binary)
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
# 6) Minimal final image
############################################################
FROM scratch

# BuildKit frontend capabilities (mirrors upstream Dockerfile frontend)
# Ref: https://github.com/moby/buildkit/blob/master/frontend/dockerfile/cmd/dockerfile-frontend/Dockerfile
LABEL moby.buildkit.frontend.network.none="true"
LABEL moby.buildkit.frontend.caps="moby.buildkit.frontend.inputs,moby.buildkit.frontend.subrequests,moby.buildkit.frontend.contexts"

# Keep PATH minimal; put binaries at root so ENTRYPOINT can reference them directly
ENV PATH=/ \
    DOCKERFILEX_TMPDIR=/workspace

# Run as non-root and default to a writeable working directory
USER 1000
WORKDIR /workspace

# Copy only the necessary runtime artifacts
COPY --link --from=certs          /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --link --from=build-frontend /app/dist-bin/ /
COPY --link --from=build-cli      /app/dist-bin/ /

# The Go frontend is the entrypoint; the CLI binary is also available in PATH
ENTRYPOINT ["/dockerfile-x-frontend"]