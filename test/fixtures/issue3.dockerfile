# syntax=devthefuture/dockerfile-x
# See https://codeberg.org/devthefuture/dockerfile-x/issues/3

FROM busybox

# include custom args from external file
INCLUDE_ARGS ./inc/custom-args.env

# include custom envvars from external file
INCLUDE_ENVS ./inc/custom-envs.env

# include custom args from external file
INCLUDE_LABELS ./inc/custom-labels.env

ENTRYPOINT [ "/bin/sh", "-c", "env" ]