# See https://codeberg.org/devthefuture/dockerfile-x/issues/3
FROM busybox
# include custom args from external file
# DOCKERFILE-X:START file="./inc/custom-args.env" includedBy="issue3.dockerfile" includeType="include"
ARG BASIC="basic"
ARG AFTER_LINE="after_line"
ARG EMPTY=""
ARG SINGLE_QUOTES="single_quotes"
ARG SINGLE_QUOTES_SPACED="    single quotes    "
ARG DOUBLE_QUOTES="double_quotes"
ARG DOUBLE_QUOTES_SPACED="    double quotes    "
ARG EXPAND_NEWLINES="expand\n\
new\n\
lines"
ARG DONT_EXPAND_UNQUOTED="dontexpand\\nnewlines"
ARG DONT_EXPAND_SQUOTED="dontexpand\\nnewlines"
ARG EQUAL_SIGNS="equals=="
ARG RETAIN_INNER_QUOTES="{\"foo\": \"bar\"}"
ARG RETAIN_INNER_QUOTES_AS_STRING="{\"foo\": \"bar\"}"
ARG TRIM_SPACE_FROM_UNQUOTED="some spaced out string"
ARG USERNAME="therealnerdybeast@example.tld"
ARG SPACED_KEY="parsed"
ARG MULTI_DOUBLE_QUOTED="THIS\n\
IS\n\
A\n\
MULTILINE\n\
STRING"
ARG MULTI_SINGLE_QUOTED="THIS\n\
IS\n\
A\n\
MULTILINE\n\
STRING"
ARG MULTI_BACKTICKED="THIS\n\
IS\n\
A\n\
\"MULTILINE'S\"\n\
STRING"
ARG MULTI_PEM_DOUBLE_QUOTED="-----BEGIN PUBLIC KEY-----\n\
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnNl1tL3QjKp3DZWM0T3u\n\
LgGJQwu9WqyzHKZ6WIA5T+7zPjO1L8l3S8k8YzBrfH4mqWOD1GBI8Yjq2L1ac3Y/\n\
bTdfHN8CmQr2iDJC0C6zY8YV93oZB3x0zC/LPbRYpF8f6OqX1lZj5vo2zJZy4fI/\n\
kKcI5jHYc8VJq+KCuRZrvn+3V+KuL9tF9v8ZgjF2PZbU+LsCy5Yqg1M8f5Jp5f6V\n\
u4QuUoobAgMBAAE=\n\
-----END PUBLIC KEY-----"
# DOCKERFILE-X:END file="./inc/custom-args.env" includedBy="issue3.dockerfile" includeType="include"
# include custom envvars from external file
# DOCKERFILE-X:START file="./inc/custom-envs.env" includedBy="issue3.dockerfile" includeType="include"
ENV BASIC="basic"
ENV AFTER_LINE="after_line"
ENV EMPTY=""
ENV EMPTY_SINGLE_QUOTES=""
ENV EMPTY_DOUBLE_QUOTES=""
ENV EMPTY_BACKTICKS=""
ENV SINGLE_QUOTES="single_quotes"
ENV SINGLE_QUOTES_SPACED="    single quotes    "
ENV DOUBLE_QUOTES="double_quotes"
ENV DOUBLE_QUOTES_SPACED="    double quotes    "
ENV DOUBLE_QUOTES_INSIDE_SINGLE="double \"quotes\" work inside single quotes"
ENV DOUBLE_QUOTES_WITH_NO_SPACE_BRACKET="{ port: \$MONGOLAB_PORT}"
ENV SINGLE_QUOTES_INSIDE_DOUBLE="single 'quotes' work inside double quotes"
ENV BACKTICKS_INSIDE_SINGLE="\`backticks\` work inside single quotes"
ENV BACKTICKS_INSIDE_DOUBLE="\`backticks\` work inside double quotes"
ENV BACKTICKS="backticks"
ENV BACKTICKS_SPACED="    backticks    "
ENV DOUBLE_QUOTES_INSIDE_BACKTICKS="double \"quotes\" work inside backticks"
ENV SINGLE_QUOTES_INSIDE_BACKTICKS="single 'quotes' work inside backticks"
ENV DOUBLE_AND_SINGLE_QUOTES_INSIDE_BACKTICKS="double \"quotes\" and single 'quotes' work inside backticks"
ENV EXPAND_NEWLINES="expand\n\
new\n\
lines"
ENV DONT_EXPAND_UNQUOTED="dontexpand\\nnewlines"
ENV DONT_EXPAND_SQUOTED="dontexpand\\nnewlines"
ENV INLINE_COMMENTS="inline comments"
ENV INLINE_COMMENTS_SINGLE_QUOTES="inline comments outside of #singlequotes"
ENV INLINE_COMMENTS_DOUBLE_QUOTES="inline comments outside of #doublequotes"
ENV INLINE_COMMENTS_BACKTICKS="inline comments outside of #backticks"
ENV INLINE_COMMENTS_SPACE="inline comments start with a"
ENV EQUAL_SIGNS="equals=="
ENV RETAIN_INNER_QUOTES="{\"foo\": \"bar\"}"
ENV RETAIN_INNER_QUOTES_AS_STRING="{\"foo\": \"bar\"}"
ENV RETAIN_INNER_QUOTES_AS_BACKTICKS="{\"foo\": \"bar's\"}"
ENV TRIM_SPACE_FROM_UNQUOTED="some spaced out string"
ENV USERNAME="therealnerdybeast@example.tld"
ENV SPACED_KEY="parsed"
# DOCKERFILE-X:END file="./inc/custom-envs.env" includedBy="issue3.dockerfile" includeType="include"
# include custom args from external file
# DOCKERFILE-X:START file="./inc/custom-labels.env" includedBy="issue3.dockerfile" includeType="include"
LABEL orgopencontainersimagesource="https://github.com/example/repo"
LABEL orgopencontainersimagerevision="0123456789"
# DOCKERFILE-X:END file="./inc/custom-labels.env" includedBy="issue3.dockerfile" includeType="include"
ENTRYPOINT [ "/bin/sh", "-c", "env" ]
