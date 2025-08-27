# See: https://codeberg.org/devthefuture/dockerfile-x/issues/27
FROM debian:latest
ARG  DEBUG
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
RUN [ -x "/hogehoge" ] \
    && echo "OK" \
    || true
ARG DEBUG1
ENV DEBUG2=1 DEBUG3=2 DEBUG4=3 \
    TEST1=1 TEST2=2 TEST3=3 \
    TIMEZONE=Asia/Tokyo
RUN <<TEST
[ -z "$DEBUG" ] || set -ex && set -e
if command -v something; then
    something \
        --arg1 test1 \
        --arg2 test2
else
    echo "something not found"
fi
TEST
