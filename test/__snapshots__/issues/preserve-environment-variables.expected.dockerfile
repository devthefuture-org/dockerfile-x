# See: https://codeberg.org/devthefuture/dockerfile-x/issues/28
FROM debian:latest
ARG  DEBUG
RUN <<'EOF'
DEBIAN_FRONTEND=noninteractive \
DEBCONF_NOWARNINGS=yes \
APT_LISTCHANGES_FRONTEND=none \
apt-get update
EOF
