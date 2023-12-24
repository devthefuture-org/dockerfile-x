# See https://codeberg.org/devthefuture/dockerfile-x.
ARG JAVA_VERSION=17
# Even if no JDK is required for rtx, use an Ubuntu base image that incudes the JDK and which is also used by other
# stages in order to reduce the total number of base images used.
FROM eclipse-temurin:$JAVA_VERSION-jdk-jammy AS build
# See https://docs.docker.com/build/cache/#use-the-dedicated-run-cache
RUN --mount=type=cache,target=/var/cache/apt   apt-get update &&   apt-get install -y --no-install-recommends   ca-certificates   curl   gnupg   &&   install -dm 755 /etc/apt/keyrings &&   curl https://rtx.jdx.dev/gpg-key.pub | gpg --dearmor > /etc/apt/keyrings/rtx-archive-keyring.gpg &&   echo "deb [signed-by=/etc/apt/keyrings/rtx-archive-keyring.gpg arch=amd64] https://rtx.jdx.dev/deb stable main" > /etc/apt/sources.list.d/rtx.list &&   apt-get update &&   apt-get install -y --no-install-recommends rtx
RUN --mount=type=cache,target=/var/cache/apt   apt-get update &&   apt-get install -y --no-install-recommends   build-essential   git
# Ease debugging of rtx errors in derived images.
ENV RTX_VERBOSE=1
# Make the tool versions available to derived images.
COPY .tool-versions .
# DOCKERFILE-X:START file="inc/python.dockerfile" includedBy="issue1.dockerfile"
FROM build AS python-build
RUN --mount=type=cache,target=/var/cache/apt   apt-get update &&   apt-get install -y --no-install-recommends   libbz2-dev   libffi-dev   liblzma-dev   libncurses-dev   libreadline-dev   libssl-dev   libz-dev
RUN rtx install python
# DOCKERFILE-X:END file="inc/python.dockerfile" includedBy="issue1.dockerfile"
