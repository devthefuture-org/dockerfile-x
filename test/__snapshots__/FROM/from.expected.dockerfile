# syntax = devthefuture/dockerfile-x
# DOCKERFILE-X:START file="./inc/downloader.dockerfile" includedBy="test/fixtures/from.dockerfile"
# DOCKERFILE-X:START file="ubuntu.dockerfile" includedBy="test/fixtures/inc/downloader.dockerfile"
ARG UBUNTU_VERSION=22.04
FROM ubuntu:$UBUNTU_VERSION AS downlofb08fb--ubuntu6a8396--final-stage
FROM downlofb08fb--ubuntu6a8396--final-stage AS downlofb08fb--ubuntu6a8396
FROM downlofb08fb--ubuntu6a8396 AS downlofb08fb
RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu
RUN mkdir /app && chown 1000:1000 /app
# DOCKERFILE-X:END file="ubuntu.dockerfile" includedBy="test/fixtures/inc/downloader.dockerfile"
RUN apt-get update &&   DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends     curl     ca-certificates     wget     git   && rm -rf /var/lib/apt/lists/*
# DOCKERFILE-X:END file="./inc/downloader.dockerfile" includedBy="test/fixtures/from.dockerfile"
FROM downlofb08fb AS final-stage
ARG NODE_VERSION=20.3.0
ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64
RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz   | tar -xzC /opt/   && mv /opt/$NODE_PACKAGE /opt/node
