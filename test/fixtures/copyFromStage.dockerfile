# syntax = devthefuture/dockerfile-x

FROM ubuntu:22.04

COPY --from=./inc/node.dockerfile#build-node --chown=1000:1000 /opt/node /opt/node
