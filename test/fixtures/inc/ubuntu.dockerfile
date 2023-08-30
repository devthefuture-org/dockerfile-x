ARG UBUNTU_VERSION=22.04
FROM ubuntu:$UBUNTU_VERSION

RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu

RUN mkdir /app && chown 1000:1000 /app