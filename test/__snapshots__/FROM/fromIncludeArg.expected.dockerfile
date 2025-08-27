ARG UBUNTU_VERSION=22.04
FROM debian AS node
ARG NODE_VERSION=20.3.0
ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64
RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz \
  | tar -xzC /opt/ \
  && mv /opt/$NODE_PACKAGE /opt/node
# DOCKERFILE-X:START file="./inc/ubuntu.dockerfile" includedBy="fromIncludeArg.dockerfile" includeType="from"
ARG UBUNTU_VERSION=22.04
FROM ubuntu:$UBUNTU_VERSION AS ubuntu9e4275--final-stage
FROM ubuntu9e4275--final-stage AS ubuntu9e4275
RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu
RUN mkdir /app && chown 1000:1000 /app
# DOCKERFILE-X:END file="./inc/ubuntu.dockerfile" includedBy="fromIncludeArg.dockerfile" includeType="from"
FROM ubuntu9e4275 AS final-stage
COPY --from=node /opt/node /opt/node
