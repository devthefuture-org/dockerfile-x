ARG NODE_VERSION
ARG NODE_PACKAGE
ARG UBUNTU_VERSION=22.04
# DOCKERFILE-X:START file="./inc/node.dockerfile" includedBy="copyFrom.dockerfile"
# DOCKERFILE-X:START file="./downloader.dockerfile" includedBy="inc/node.dockerfile"
# DOCKERFILE-X:START file="ubuntu.dockerfile" includedBy="inc/downloader.dockerfile"
ARG UBUNTU_VERSION=22.04
FROM ubuntu:$UBUNTU_VERSION AS nodee5203c--downlo550515--ubuntu9e4275--final-stage
FROM nodee5203c--downlo550515--ubuntu9e4275--final-stage AS nodee5203c--downlo550515--ubuntu9e4275
FROM nodee5203c--downlo550515--ubuntu9e4275 AS nodee5203c--downlo550515
RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu
RUN mkdir /app && chown 1000:1000 /app
# DOCKERFILE-X:END file="ubuntu.dockerfile" includedBy="inc/downloader.dockerfile"
RUN apt-get update &&   DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends     curl     ca-certificates     wget     git   && rm -rf /var/lib/apt/lists/*
# DOCKERFILE-X:END file="./downloader.dockerfile" includedBy="inc/node.dockerfile"
FROM nodee5203c--downlo550515 AS nodee5203c--build-node
# renovate: datasource=node depName=node versioning=node
ARG NODE_VERSION=20.3.0
ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64
RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz   | tar -xzC /opt/   && mv /opt/$NODE_PACKAGE /opt/node
# DOCKERFILE-X:START file="./ubuntu.dockerfile" includedBy="inc/node.dockerfile"
ARG UBUNTU_VERSION=22.04
FROM ubuntu:$UBUNTU_VERSION AS nodee5203c--ubuntu9e4275--final-stage
FROM nodee5203c--ubuntu9e4275--final-stage AS nodee5203c--ubuntu9e4275
RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu
RUN mkdir /app && chown 1000:1000 /app
# DOCKERFILE-X:END file="./ubuntu.dockerfile" includedBy="inc/node.dockerfile"
FROM nodee5203c--ubuntu9e4275 AS nodee5203c--final-stage
FROM nodee5203c--final-stage AS nodee5203c
COPY --from=nodee5203c--build-node /opt/node /opt/node
ENV NODE_PATH /opt/node/lib/node_modules
ENV PATH /opt/node/bin:$PATH
RUN npm i -g yarn
RUN mkdir /yarn
RUN chown 1000:1000 /yarn
ENV YARN_CACHE_FOLDER /yarn
WORKDIR /app
USER 1000
# DOCKERFILE-X:END file="./inc/node.dockerfile" includedBy="copyFrom.dockerfile"
FROM ubuntu:22.04
COPY --from=nodee5203c --chown=1000:1000 /opt /opt/
