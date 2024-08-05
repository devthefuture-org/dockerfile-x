# DOCKERFILE-X:START file="./inc/downloader.dockerfile" includedBy="fromStageAlias.dockerfile" includeType="from"
# DOCKERFILE-X:START file="ubuntu.dockerfile" includedBy="inc/downloader.dockerfile" includeType="include"
ARG UBUNTU_VERSION=22.04
FROM ubuntu:$UBUNTU_VERSION AS downlo550515--ubuntu9e4275--final-stage
FROM downlo550515--ubuntu9e4275--final-stage AS downlo550515--ubuntu9e4275
FROM downlo550515--ubuntu9e4275 AS downlo550515
RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu
RUN mkdir /app && chown 1000:1000 /app
# DOCKERFILE-X:END file="ubuntu.dockerfile" includedBy="inc/downloader.dockerfile" includeType="include"
RUN apt-get update &&   DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends   curl   ca-certificates   wget   git   && rm -rf /var/lib/apt/lists/*
# DOCKERFILE-X:END file="./inc/downloader.dockerfile" includedBy="fromStageAlias.dockerfile" includeType="from"
FROM downlo550515 AS build-node
ARG NODE_VERSION=20.3.0
ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64
RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz   | tar -xzC /opt/   && mv /opt/$NODE_PACKAGE /opt/node
FROM build-node AS build-node-extra
RUN npm install -g yarn
