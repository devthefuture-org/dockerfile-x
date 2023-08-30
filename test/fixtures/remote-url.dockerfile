# syntax = devthefuture/dockerfile-x

FROM https://codeberg.org/devthefuture/dockerfile-x/raw/branch/master/test/fixtures/inc/ubuntu.dockerfile

COPY --from=https://codeberg.org/devthefuture/dockerfile-x/raw/branch/master/test/fixtures/inc/node.dockerfile#build-node /opt /opt
