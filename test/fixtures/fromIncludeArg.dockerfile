# syntax = devthefuture/dockerfile-x

FROM debian as node
ARG NODE_VERSION=20.3.0
ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64

RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz \
  | tar -xzC /opt/ \
  && mv /opt/$NODE_PACKAGE /opt/node

FROM ./inc/ubuntu.dockerfile
COPY --from=node /opt/node /opt/node