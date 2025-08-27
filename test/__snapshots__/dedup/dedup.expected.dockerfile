ARG UBUNTU_VERSION=22.04
# DOCKERFILE-X:START file="./inc/downloader.dockerfile" includedBy="dedup.dockerfile" includeType="from"
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
RUN apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends \
  curl \
  ca-certificates \
  wget \
  git \
  && rm -rf /var/lib/apt/lists/*
# DOCKERFILE-X:END file="./inc/downloader.dockerfile" includedBy="dedup.dockerfile" includeType="from"
FROM downlo550515 AS download-node
ARG NODE_VERSION=20.3.0
ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64
RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz \
  | tar -xzC /opt/ \
  && mv /opt/$NODE_PACKAGE /opt/node
# DOCKERFILE-X:START file="./inc/downloader.dockerfile" includedBy="dedup.dockerfile" includeType="from"
# DOCKERFILE-X:START file="ubuntu.dockerfile" includedBy="inc/downloader.dockerfile" includeType="include"
ARG UBUNTU_VERSION=22.04
FROM downlo550515 AS download-kubectl
ARG KUBECTL_VERSION=1.27.1
ENV KUBECTL_VERSION=$KUBECTL_VERSION
RUN curl --fail -sL https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/amd64/kubectl > /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl
