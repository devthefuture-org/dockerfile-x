# syntax = devthefuture/dockerfile-x

FROM ./ubuntu.dockerfile AS build

RUN echo "foobar">/home/ubuntu/test.log

FROM scratch
RUN --mount=type=bind,from=build,source:/home/ubuntu,target=/home/ubuntu,rw cp /home/ubuntu/test.log /
