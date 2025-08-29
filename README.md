# devthefuture/dockerfile-x: Dockerfile factorization superset

`dockerfile-x` empowers developers with an extended syntax that allow modular factorization with ease.

## Getting Started:

To enable `dockerfile-x` custom syntax, you can use native docker buildkit frontend feature by adding syntax comment to the beginning of your Dockerfile:

```Dockerfile
# syntax = devthefuture/dockerfile-x

FROM ./base/dockerfile

COPY --from=./build/dockerfile#build-stage /app /app

INCLUDE ./other/dockerfile
```

That's it!

then you can run buildkit as usual:

```sh
docker build .
```

note that you can also use `docker compose` or other tools that rely on docker buildkit.

this will compile the final Dockerfile using [devthefuture/dockerfile-x](https://hub.docker.com/r/devthefuture/dockerfile-x) docker image, just before running the build

### Requirements

We recommend using Docker 20.10 or later.

However, if you're working with Docker versions as old as 18.09, you can still enable BuildKit. To do so, you'll need to set the following environment variables: `DOCKER_BUILDKIT=1` and `COMPOSE_DOCKER_CLI_BUILD=1`.

## Features:
- [INCLUDE](#include): Incorporate content as is from other Dockerfiles or snippets.
- [INCLUDE_ARGS](#include_args): Converts a `.env` file into Dockerfile `ARG` instructions.
- [INCLUDE_ENVS](#include_envs): Converts a `.env` file into Dockerfile `ENV` instructions.
- [INCLUDE_LABELS](#include_labels): Converts a `.env` file into Dockerfile `LABEL` instructions.
- [FROM](#from):
  - [FROM with Relative Paths](#from-with-relative-paths): Use other Dockerfiles as a base using relative paths.
  - [FROM with Stages](#from-with-stages): Reference specific stages from other Dockerfiles.
  - [FROM with Re-Alias](#from-with-re-alias): Rename specific stages from other Dockerfiles.
- [COPY --from](#copy-from):
  - [COPY/ADD from Another Dockerfile](#copy-add-from-another-dockerfile): Transfer files from another Dockerfile.
  - [COPY/ADD with Stages](#copy-add-with-stages): Specify a stage when copying files from another Dockerfile.

## Behavior

### `FROM` File Syntax:

For a file to be recognized as an included Dockerfile, the `FROM|` or `--from` parameters must begin with either a `.` (examples: `./another/dockerfile` or `../parent-dir/my.dockerfile`) or `/`. Any Dockerfile imported via this custom `FROM` syntax will be treated according to the rules specified below.

### Scoping:

- Dockerfiles included via the `INCLUDE` instruction are integrated as they are, without any modifications.
 
- Dockerfiles brought in through the `FROM` instruction or `--from` parameters undergo scoping to prevent conflicts with other Dockerfiles. Specifically:
  - All stages are renamed based on the scope.
  - This scoping is transparent to users: one can re-alias imported stages (or the final stage of the imported Dockerfile if no stage is explicitly mentioned) and utilize them as needed.

- All processing and the features described are recursive. Only the final stages of the root Dockerfile are made visible to the user, suitable for use with the `--target` parameter during a Docker build.

- A Dockerfile can be imported many times using `FROM` instruction or `--from` parameters, at same or different stages, the imported stages will be deduplicated automatically.

- The paths resolutions **for imported Dockerfiles from the root Dockerfile** are relative to the docker build context, not the root Dockerfile itself. This is due to a limitation in BuildKit and this is consistent with other instructions that are also relative the context. The imported Dockerfiles must be in the build context, but can be safely ignored from .dockerignore. Symlinking does not help in this case.
- However, the paths resolutions **for imported Dockerfiles from the imported Dockerfiles** are relative to the imported Dockerfile itself.

### Dockerfile Extension:

- If you're importing a Dockerfile with the `.dockerfile` extension, you don't need to specify the extension; it will be detected automatically.


## Examples:

Basic INCLUDE

```Dockerfile
INCLUDE ./common-instructions.dockerfile

FROM debian:latest

CMD ["bash"]
```

Using stages from another Dockerfile

```Dockerfile
FROM ./base/dockerfile#dev AS development

COPY . /app

FROM ./base/dockerfile#prod AS production

COPY --from=development /app /app
CMD ["start-app"]
```

Re-aliasing a stage

```Dockerfile
FROM ./complex-setup/dockerfile#old-stage-name AS new-name

COPY ./configs /configs
```

## Features documentation:

### INCLUDE

Easily include content from another Dockerfile or snippet, ensuring straightforward reuse of Dockerfile segments across projects.

```Dockerfile
# Include another Dockerfile's content
INCLUDE ./path/to/another/dockerfile
```

### INCLUDE_ARGS

Converts key-value pairs from a `.env` file into Dockerfile `ARG` instructions.
Use this to expose build-time variables without hardcoding them into the Dockerfile.

```text
# custom-args.env
NODE_VERSION=20.11.1
PNPM_VERSION=9.1.0
```

```Dockerfile
# Include key-value pairs from file
INCLUDE_ARGS ./path/to/custom-args.env
```

This expands to:
```Dockerfile
ARG NODE_VERSION="20.11.1"
ARG PNPM_VERSION="9.1.0"
```

**Note:** Values can be overridden at build time with `--build-arg` if desired.

### INCLUDE_ENVS

Converts key-value pairs from a `.env` file into Dockerfile `ENV` instructions.
Ideal for runtime configuration baked into the image.

```text
# custom-envvars.env
NODE_ENV=production
APP_PORT=8080
```

```Dockerfile
# Include key-value pairs from file
INCLUDE_ENVS ./path/to/custom-envvars.env
```

This expands to:
```Dockerfile
ENV NODE_ENV="production"
ENV APP_PORT="8080"
```

### INCLUDE_LABELS
Converts key-value pairs from a `.env` file into Dockerfile `LABEL` instructions.
Useful for image metadata (e.g., authorship, version, VCS refs).

```text
# custom-labels.env
org.opencontainers.image.title=myapp
org.opencontainers.image.version=1.2.3
org.opencontainers.image.revision=abc1234
```

```Dockerfile
# Include key-value pairs from file
INCLUDE_LABELS ./path/to/custom-labels.env
```

This expands to:
```Dockerfile
LABEL org.opencontainers.image.title="myapp" 
LABEL org.opencontainers.image.version="1.2.3" 
LABEL org.opencontainers.image.revision="abc1234"
```

### FROM

#### FROM with Relative Paths

Instead of using image names from DockerHub or another registry, use relative paths to refer to other Dockerfiles directly.

```Dockerfile
# Use another Dockerfile as a base
FROM ./path/to/another/dockerfile
```

#### FROM with Stages

Or use a specific stage from another Dockerfile:

```Dockerfile
# Use a specific stage from another Dockerfile
FROM ./path/to/another/dockerfile#stage-name

```

#### FROM with Re-Alias

Re-alias a specific stage from another Dockerfile to a new name, providing flexibility in naming.

```Dockerfile
# Re-alias a stage from another Dockerfile
FROM ./path/to/another/dockerfile#original-stage-name AS new-stage-name
```

### COPY --from

#### COPY/ADD from Another Dockerfile

Copy or add files directly from another Dockerfile, streamlining the process of transferring files between build stages.

```Dockerfile
# Copy files from another Dockerfile
COPY --from=/path/to/another/dockerfile source-path destination-path

# Add files from another Dockerfile
ADD --from=/path/to/another/dockerfile source-path destination-path
```

#### COPY/ADD with Stages

Or specify a stage from which to copy or add:

```Dockerfile
# Copy files from a specific stage of another Dockerfile
COPY --from=/path/to/another/dockerfile#stage-name source-path destination-path
```

## Addressing Dockerfile Evolution Concerns

Understanding concerns regarding feature availability with alternative frontends:

Some might worry that alternative frontends would lack the ability to layer on top of the official `docker/dockerfile`, potentially missing out on its additional features. Let's address this concern for `dockerfile-x`.

### How `dockerfile-x` Operates:
1. **Node.js Compilation**: The Node.js component compiles custom Dockerfile syntax into the standard Dockerfile format in a superset manner.
2. **BuildKit Frontend Service**: This service then translates the standard Dockerfile to LLB. This step uses minimal custom code, predominantly relying on official BuildKit packages.

### Addressing Future Updates to `docker/dockerfile`:
Though updates to `docker/dockerfile` aren't frequent, here's how we'd accommodate them:

1. **Upgrade the Go Package**: The Go part of `dockerfile-x` is lean in terms of custom code. Thus, maintaining it and integrating any updates from `docker/dockerfile` would be straightforward.
2. **Direct Compilation with Node.js**: Instead of using the custom syntax frontend, users can compile the Dockerfile-X directly to a standard Dockerfile using only the Node.js component. This standalone CLI tool can be used via the command `npx dockerfile-x` (further details available with `--help`). Any new additions to `docker/dockerfile`, like novel keywords, would be inherently supported without needing any modifications to this library.

In essence, one could think of `dockerfile-x` as a dedicated template engine specially crafted for Dockerfiles.


## Why

With the growing complexity of Docker setups, this tool ensures your Dockerfiles remain clean, maintainable, and modular.

### Related

- https://github.com/moby/moby/issues/735
- https://stackoverflow.com/questions/36362233/can-a-dockerfile-extend-another-one

## Contributing:

We welcome contributions! If you encounter a bug or have a feature suggestion, please open an issue. To contribute code, simply fork the repository and submit a pull request.

This repository is mirrored on both GitHub and Codeberg. Contributions can be made on either platform, as the repositories are synchronized bidirectionally. 
- Codeberg: [https://codeberg.org/devthefuture/dockerfile-x](https://codeberg.org/devthefuture/dockerfile-x)
- GitHub: [https://github.com/devthefuture-org/dockerfile-x](https://github.com/devthefuture-org/dockerfile-x)

For more information:
- [Why mirror to Codeberg?](https://codeberg.org/Recommendations/Mirror_to_Codeberg#why-should-we-mirror-to-codeberg)
- [GitHub to Codeberg mirroring tutorial](https://codeberg.org/Recommendations/Mirror_to_Codeberg#github-codeberg-mirroring-tutorial)


### Development

#### Enable debugging

`/etc/docker/daemon.json`

```json
{
    "experimental": true,
    "debug": true
}
```

```sh
sudo systemctl restart docker
```

then observe the logs
```sh
journalctl -u docker.service -f
```

## TODO NEXT

### features:
- remote url feature with recursive remote resolution
- allow customization hook/plugins autoloading .dockerfile-x.js or .dockerfile-x/index.js (eg: integration of yarn workspaces topographically)

### ci .gitea (for codeberg):
- release
- publish to npm
- build and push images to docker registry and codeberg registry