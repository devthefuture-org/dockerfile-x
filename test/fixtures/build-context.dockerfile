# syntax = devthefuture/dockerfile-x:dev
FROM busybox
COPY --from=dockerfile-x /dockerfile-x-frontend /dockerfile-x-frontend