# syntax = devthefuture/dockerfile-x
# DOCKERFILE-X:START file="./inc/long-stage-name.dockerfile" includedBy="stage-name-truncation.dockerfile"
FROM ubuntu:22.04 AS long-s1be4ee--there-are-many-different--and-not-always-compatible--definitions-of-what-ubuntu-is-even-with-the-various-definitions---buntu-encompasses-the-interdependence-of-humans-on-another-and-the-acknowledgment-of-one-s-responsibility-to-th-9edc53a19d
FROM long-s1be4ee--there-are-many-different--and-not-always-compatible--definitions-of-what-ubuntu-is-even-with-the-various-definitions---buntu-encompasses-the-interdependence-of-humans-on-another-and-the-acknowledgment-of-one-s-responsibility-to-th-9edc53a19d AS long-s1be4ee
RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu
RUN mkdir /app && chown 1000:1000 /app
# DOCKERFILE-X:END file="./inc/long-stage-name.dockerfile" includedBy="stage-name-truncation.dockerfile"
FROM long-s1be4ee AS final-stage
