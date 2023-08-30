FROM ./downloader.dockerfile AS build-node

# renovate: datasource=node depName=node versioning=node
ARG NODE_VERSION=20.3.0

ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64

RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz \
  | tar -xzC /opt/ \
  && mv /opt/$NODE_PACKAGE /opt/node

FROM ./ubuntu.dockerfile

COPY --from=build-node /opt/node /opt/node
ENV NODE_PATH /opt/node/lib/node_modules
ENV PATH /opt/node/bin:$PATH

RUN npm i -g yarn
RUN mkdir /yarn
RUN chown 1000:1000 /yarn
ENV YARN_CACHE_FOLDER /yarn

WORKDIR /app
USER 1000