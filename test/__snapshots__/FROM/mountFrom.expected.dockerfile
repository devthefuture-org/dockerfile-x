# DOCKERFILE-X:START file="./inc/mountFromParent.dockerfile" includedBy="mountFrom.dockerfile"
# DOCKERFILE-X:START file="./ubuntu.dockerfile" includedBy="inc/mountFromParent.dockerfile"
ARG UBUNTU_VERSION=22.04
FROM ubuntu:$UBUNTU_VERSION AS mountf59931e--ubuntu9e4275--final-stage
FROM mountf59931e--ubuntu9e4275--final-stage AS mountf59931e--ubuntu9e4275
RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu
RUN mkdir /app && chown 1000:1000 /app
# DOCKERFILE-X:END file="./ubuntu.dockerfile" includedBy="inc/mountFromParent.dockerfile"
FROM mountf59931e--ubuntu9e4275 AS mountf59931e--build
RUN echo "foobar">/home/ubuntu/test.log
FROM scratch AS mountf59931e--final-stage
FROM mountf59931e--final-stage AS mountf59931e
RUN --mount=type=bind,from=mountf59931e--build,source:/home/ubuntu,target=/home/ubuntu,rw cp /home/ubuntu/test.log /
# DOCKERFILE-X:END file="./inc/mountFromParent.dockerfile" includedBy="mountFrom.dockerfile"
FROM mountf59931e AS build
