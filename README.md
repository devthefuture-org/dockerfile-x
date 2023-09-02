# devthefuture/dockerfile-x: Dockerfile factorization superset

`dockerfile-x` empowers developers with an extended syntax that allow modular factorization with ease.

## Getting Started:

To enable dockerfile-x` custom syntax, you can use native docker buildkit frontend feature by adding syntax comment to the beginning of your Dockerfile:

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
- [FROM](#from):
  - [FROM with Relative Paths](#from-with-relative-paths): Use other Dockerfiles as a base using relative paths.
  - [FROM with Stages](#from-with-stages): Reference specific stages from other Dockerfiles.
  - [FROM with Re-Alias](#from-with-re-alias): Rename specific stages from other Dockerfiles.
- [COPY --from](#copy---from):
  - [COPY/ADD from Another Dockerfile](#copyadd-from-another-dockerfile): Transfer files from another Dockerfile.

  - [COPY/ADD with Stages](#copyadd-with-stages): Specify a stage when copying files from another Dockerfile.

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

## Why

With the growing complexity of Docker setups, this tool ensures your Dockerfiles remain clean, maintainable, and modular.

### Related

- https://github.com/moby/moby/issues/735
- https://stackoverflow.com/questions/36362233/can-a-dockerfile-extend-another-one

## Contributing:

We welcome contributions! If you find a bug or have a feature request, please open an issue. If you'd like to contribute code, please fork the repository and submit a pull request.

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

## TODO

- remote url feature with recursive remote resolution
- add .gitea ci for codeberg:
  - release
  - publish to npm
  - build and push images to docker registry and codeberg registry
  - sync the repo with github (with link to canonical codeberg repository)