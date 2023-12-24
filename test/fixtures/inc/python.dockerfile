FROM build AS python-build

RUN --mount=type=cache,target=/var/cache/apt \
  # Install tools required for building.
  apt-get update && \
  apt-get install -y --no-install-recommends \
  libbz2-dev \
  libffi-dev \
  liblzma-dev \
  libncurses-dev \
  libreadline-dev \
  libssl-dev \
  libz-dev

RUN rtx install python