# syntax = devthefuture/dockerfile-x:1.4.3
FROM debian:latest
ARG DEBUG
SHELL ["/bin/bash", "-lc"]

# Heredoc with preserved indentation and continuations
RUN <<'EOF'
[ -z "$DEBUG" ] || set -ex && set -e
if command -v something; then
    something \
        --arg1 test1 \
        --arg2 test2
else
    echo "something not found"
fi
EOF
