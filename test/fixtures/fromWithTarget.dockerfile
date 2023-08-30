# syntax = devthefuture/dockerfile-x

FROM ./inc/node.dockerfile#build-node

RUN npm i -g yarn
