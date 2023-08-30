FROM ubuntu:22.04 AS there-are-many-different--and-not-always-compatible--definitions-of-what-ubuntu-is-even-with-the-various-definitions---buntu-encompasses-the-interdependence-of-humans-on-another-and-the-acknowledgment-of-one-s-responsibility-to-their-fellow-humans-and-the-world-around-them

RUN groupadd -g 1000 ubuntu && useradd -rm -d /home/ubuntu -s /bin/bash -g ubuntu -G sudo -u 1000 ubuntu
ENV HOME=/home/ubuntu
RUN chmod 0777 /home/ubuntu

RUN mkdir /app && chown 1000:1000 /app

