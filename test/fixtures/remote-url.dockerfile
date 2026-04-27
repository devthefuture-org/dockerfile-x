# syntax = devthefuture/dockerfile-x
#
# Example fixture showing the three remote include schemes.
# This file is for documentation only — not consumed by the test runner.

# 1) HTTP(S)
INCLUDE https://example.com/snippets/setup.dockerfile

# 2) Git (sparse fetch of a single file at a precise ref)
FROM git+https://github.com/foo/bar.git#main:base/alpine.dockerfile AS base

# 3) OCI artifact (pulled via oras using ~/.docker/config.json auth)
INCLUDE oci://ghcr.io/foo/bar:1.0#dockerfiles/common.dockerfile
