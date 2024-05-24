# syntax = devthefuture/dockerfile-x
FROM busybox
COPY --from=dockerfile-x /dockerfile-x-frontend /dockerfile-x-frontend