# CLAUDE.md

Project context for Claude Code working in this repo.

## Architecture

Hybrid Go + Node.js. **All Dockerfile transpilation lives in [src/](src/) (Node).**
Go ([main.go](main.go), [pkg/](pkg/)) is a thin BuildKit frontend that:

1. Receives the user's Dockerfile from BuildKit
2. Shells out to the bundled `dockerfile-x` Node binary to transpile it
3. Hands the resulting standard Dockerfile to the upstream `dockerfile-frontend`

When adding a feature, the answer is almost always Node.js. The Go layer only changes for new BuildKit-level capabilities.

### Frontend ↔ CLI contract ([pkg/build/dockerfile-x.go](pkg/build/dockerfile-x.go))

- CLI exit `0` + stdout = transpiled Dockerfile.
- CLI exit `2` + JSON on stdout = structured error. Go inspects `{"error":...}`:
  - `"missing-file"` → Go pulls `filename` from the build context via LLB and retries (legacy mechanism for local files referenced from outside the context).
  - Any other code → surfaced as a build error.
- All structured errors must be emitted via [`emitJsonErrorAndExit`](src/errors/emitJsonError.js) using a constant from [`src/errors/codes.js`](src/errors/codes.js). Don't invent ad-hoc error shapes.

## Source abstraction ([src/sources/](src/sources/))

Every include reference (local, http, git+, oci://) is wrapped in a `Source`. Contract:

- `read()` → file content
- `joinRelative(relPath)` → child source for a relative ref **in the same domain**
- `key()` → cycle-detection identity
- `displayPath(dockerContext)` → label for `# DOCKERFILE-X:START` markers
- `stageAliasBase(dockerContext)` → seed for stage-name slug
- `fsPath()` → real fs path for local sources, `null` otherwise
- `async resolve()` → eagerly pin remote identity (git oid / oci digest) before `key()` is read

**[`resolveSource(ref, ctx)`](src/sources/resolveSource.js) is the only place that detects schemes.** It enforces that `Source.joinRelative` is only called with a scheme-less relative or absolute path — any unrecognized URI scheme is rejected up front so a remote-served Dockerfile can't pivot subsequent INCLUDEs to a different scheme/host. New source backends just plug in here — never re-implement scheme detection in instruction handlers.

## Recursion model ([src/core/loadDockerfile.js](src/core/loadDockerfile.js))

`loadDockerfile(source, fileContext)` is the recursive entry point. Guards:
- `MAX_INCLUDE_DEPTH` (default 32, override `--max-include-depth` / `DOCKERFILEX_MAX_INCLUDE_DEPTH`)
- Cycle detection via `includeChain` of `source.key()`s

Both apply uniformly to local and remote sources.

## Path resolution quirk

Children of the **root** local Dockerfile resolve relative to `dockerContext`, **not** to the root file's dirname — a BuildKit limitation documented in the README. Implemented by giving the root `LocalSource` a `relativeBase = dockerContext` ([src/core/rootLoadDockerfile.js](src/core/rootLoadDockerfile.js)). Don't put this branching back into instruction handlers.

## Tests

- Framework: Mocha + [`mocha-snap`](https://www.npmjs.com/package/mocha-snap). Run with `yarn test`; regenerate snapshots with `yarn test:update`.
- Snapshot fixtures: input in [test/fixtures/](test/fixtures/), expected in [test/__snapshots__/](test/__snapshots__/) named after the `describe`/`it` blocks.
- Fixture-based test runner: [test/common/testFixture.js](test/common/testFixture.js) execs `node index.js` against a fixture and snaps the output.
- **Tests that spin up an in-process server (HTTP, git, OCI registry) must spawn the CLI via `child_process.spawn`, not `execSync`** — `execSync` blocks the Node event loop, which prevents the in-process server from accepting the CLI's request, causing a deadlock.

## Build & release

- `yarn build:ncc` — bundle Node sources into `dist/index.js` (one file). Fast.
- `yarn build:pkg` — produce a `pkg`-static Node binary in `dist-bin/`.
- `yarn build` — both.
- `make docker-build-dev` — build + push `devthefuture/dockerfile-x:dev`. Use this for BuildKit-frontend e2e tests; `# syntax = ...:dev` requires a pushed image, `--load` alone does not work.
- `make docker-push` — full multi-tag release. Don't run unless the user explicitly asks.
- `yarn lint` — currently broken (legacy ESLint config). Skip; no need to fix unless asked.

## Dockerfile / runtime image

Final stage is `alpine:3` with `git`, `oras`, `ca-certificates`, and `docker-credential-ecr-login`. The label `moby.buildkit.frontend.network.none` is **not** declared because the frontend fetches remote sources at compile time. Other credential helpers (gcloud, acr) are user-installable via a derived image.

## E2E against the published frontend

To test as `# syntax = devthefuture/dockerfile-x:dev`:
- The BuildKit frontend container reaches the host via `172.17.0.1` (Docker default bridge gateway). `127.0.0.1` is the container's own loopback.
- Local registries need plain HTTP — `OciSource` auto-enables `--plain-http` for `127.0.0.1`/`localhost` and falls back automatically on `server gave HTTP response to HTTPS client`.

## Conventions

- Don't read user credential files (`~/.docker/config.json`, `~/.aws/credentials`, `~/.netrc`, `.env`, SSH keys). Probe via tool auth flows; never `cat`/`grep`/`Read` them.
- Don't add backward-compatibility shims; this is a transpiler, not a public library.
- Existing utilities live in [src/utils/](src/utils/) (`checkFileExists`, `ensureDir`, `shortHash`, `generateFilePathSlug`) and [src/lib/](src/lib/) (`parseDockerfile`, `downloadWithCache`, `spawnCmd`). Prefer these over hand-rolling.
