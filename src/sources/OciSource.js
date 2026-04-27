const path = require("path")
const fs = require("fs/promises")
const os = require("os")

const Source = require("./Source")
const spawnCmd = require("../lib/spawnCmd")
const ensureDir = require("../utils/ensureDir")
const shortHash = require("../utils/shortHash")
const checkFileExists = require("../utils/checkFileExists")
const tryWithExtension = require("./tryWithExtension")
const assertContained = require("./assertContained")
const { assertContainedReal } = require("./assertContained")
const sanitizeRelativePath = require("./sanitizeRelativePath")
const RemoteFileNotFoundError = require("../errors/RemoteFileNotFoundError")
const { REMOTE_FETCH_FAILED } = require("../errors/codes")

const artifactCache = new Map() // resolved entries OR in-flight Promise<entry>
const digestResolveCache = new Map() // `registry/repo:tag` -> Promise<digest>

function ociCacheRoot() {
  return (
    process.env.DOCKERFILEX_OCI_CACHE_DIR ||
    path.join(os.homedir(), ".dockerfile-x", "oci-cache")
  )
}

// Memoize the Docker config dir so we don't leak a fresh temp dir for every
// OCI include when /run/secrets/docker-config is in play. Cleanup is registered
// once on first creation.
let dockerConfigDirPromise = null
let dockerConfigCleanupRegistered = false

/**
 * Pick a Docker config dir for oras to consume via DOCKER_CONFIG.
 * Cascade: build secret /run/secrets/docker-config -> $DOCKER_CONFIG -> $HOME/.docker
 * Result is memoized for the process lifetime.
 */
function resolveDockerConfigDir() {
  if (dockerConfigDirPromise) return dockerConfigDirPromise
  dockerConfigDirPromise = (async () => {
    if (await checkFileExists("/run/secrets/docker-config")) {
      // Build secret is a single file; oras expects a directory containing config.json.
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfx-docker-config-"))
      await fs.copyFile(
        "/run/secrets/docker-config",
        path.join(dir, "config.json"),
      )
      if (!dockerConfigCleanupRegistered) {
        dockerConfigCleanupRegistered = true
        const cleanup = () => {
          try {
            require("fs").rmSync(dir, { recursive: true, force: true })
          } catch {
            /* best-effort */
          }
        }
        process.once("exit", cleanup)
      }
      return dir
    }
    const candidates = []
    if (process.env.DOCKER_CONFIG) candidates.push(process.env.DOCKER_CONFIG)
    if (process.env.HOME) candidates.push(path.join(process.env.HOME, ".docker"))
    for (const dir of candidates) {
      if (await checkFileExists(path.join(dir, "config.json"))) return dir
    }
    return null
  })()
  // If the first attempt fails, allow a retry on the next call.
  dockerConfigDirPromise.catch(() => {
    dockerConfigDirPromise = null
  })
  return dockerConfigDirPromise
}

function findOrasBin() {
  return process.env.DOCKERFILEX_ORAS_BIN || "oras"
}

// Reject registry/repo/tag values whose first byte would let oras (cobra-based
// CLI) parse them as an option flag. Defense-in-depth: oras refs are already
// constrained by parse(), but a stray `--` would still confuse the binary.
function rejectOptionLikeArg(value, kind) {
  if (typeof value === "string" && value.startsWith("-")) {
    throw new Error(
      `Invalid oci ${kind}: ${value} (must not start with '-' to avoid being parsed as a flag)`,
    )
  }
}

function isLocalRegistry(registry) {
  const host = registry.split(":")[0]
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]"
}

function shouldUsePlainHttp(registry) {
  if (process.env.DOCKERFILEX_ORAS_PLAIN_HTTP === "true") return true
  return isLocalRegistry(registry)
}

// Auto-fallback from HTTPS to plain HTTP is restricted to localhost (or to an
// explicit DOCKERFILEX_ORAS_PLAIN_HTTP=true) — silently downgrading a public
// registry on a TLS error would mask MITM and misconfigurations.
function shouldAttemptPlainHttpFallback(registry) {
  if (process.env.DOCKERFILEX_ORAS_PLAIN_HTTP === "true") return true
  return isLocalRegistry(registry)
}

const isPlainHttpMismatch = (err) =>
  /server gave HTTP response to HTTPS client/i.test(
    (err && err.stderr) || "",
  )

// Per-algorithm hex-length requirement. Other algorithms are allowed through
// the loose `DIGEST_RE` for parse-time matching, but `assertValidDigest`
// requires that registry-emitted digests for known algorithms be exactly the
// right length — otherwise a truncated/malformed `sha256:a` would slip into
// the cycle key.
const DIGEST_ALGO_LEN = {
  sha256: 64,
  sha384: 96,
  sha512: 128,
}

// Validate that a digest string matches the OCI spec. Used everywhere a digest
// is sourced from external bytes (registry response, index.json) before it
// becomes part of a cycle key or `key()` output. Tagged as REMOTE_FETCH_FAILED
// so the CLI surfaces it as a structured error (not an unhandled rejection).
function assertValidDigest(digest, context) {
  const fail = () => {
    const err = new Error(
      `invalid OCI digest from ${context}: ${JSON.stringify(digest)}`,
    )
    err.code = REMOTE_FETCH_FAILED
    throw err
  }
  if (typeof digest !== "string" || !DIGEST_RE.test(`@${digest}`)) fail()
  const colon = digest.indexOf(":")
  const algo = digest.slice(0, colon).toLowerCase()
  const hex = digest.slice(colon + 1)
  const expected = DIGEST_ALGO_LEN[algo]
  // Unknown algorithms keep the loose check (registries may publish algos we
  // don't enumerate yet); known ones must match length exactly.
  if (expected !== undefined && hex.length !== expected) fail()
}

async function readPulledDigest(dir) {
  // After `oras pull --output <dir>`, the artifact's manifest digest is not
  // always written to <dir>; oras typically writes only the artifact files.
  // Best-effort: if an OCI layout `index.json` is present, validate and use
  // its digest; otherwise return null. The cycle key for moving tags comes
  // from `resolve()` (oras manifest fetch --descriptor) which runs before
  // `read()` in loadDockerfile.js, so this fallback only loses the
  // pull-side digest cross-check, not cycle detection.
  let indexJson
  try {
    indexJson = await fs.readFile(path.join(dir, "index.json"), "utf-8")
  } catch {
    return null
  }
  let digest
  try {
    digest = JSON.parse(indexJson)?.manifests?.[0]?.digest
  } catch {
    return null
  }
  if (!digest) return null
  assertValidDigest(digest, `${dir}/index.json`)
  return digest
}

async function ensureArtifact(registry, repo, tagOrDigest) {
  // tagOrDigest is either `:tag` form (resolved later via readPulledDigest)
  // or `@<algo>:<hex>` form (immutable, can be cached forever).
  const ref = `${registry}/${repo}${tagOrDigest}`
  const cacheKey = ref
  // Cache may hold either the resolved entry or an in-flight Promise — second
  // concurrent caller awaits the first one's pull instead of racing it.
  const cached = artifactCache.get(cacheKey)
  if (cached) return cached

  const work = (async () => {
    const root = ociCacheRoot()
    await ensureDir(root)
    const dir = path.join(root, shortHash(cacheKey))

    // Already populated? Reuse it. We treat "non-empty dir with index.json or
    // any artifact file" as populated; an OCI pull always writes index.json.
    if (await checkFileExists(path.join(dir, "index.json"))) {
      const digest = await readPulledDigest(dir)
      return { dir, digest }
    }

    // Pull into a unique tmp dir, then rename into place. The rename is
    // atomic on the same fs *only* when `dir` doesn't already exist; the
    // ENOTEMPTY/EEXIST fallback below covers the lost-race case where another
    // process populated `dir` first.
    const tmpDir = `${dir}.tmp-${process.pid}-${Date.now()}`
    await fs.rm(tmpDir, { recursive: true, force: true })
    await ensureDir(tmpDir)

    const dockerConfigDir = await resolveDockerConfigDir()
    const env = {
      ...process.env,
      ...(dockerConfigDir ? { DOCKER_CONFIG: dockerConfigDir } : {}),
    }

    const orasBin = findOrasBin()
    let plainHttp = shouldUsePlainHttp(registry)

    const runOras = async (args) => {
      const httpArgs = plainHttp ? ["--plain-http"] : []
      try {
        return await spawnCmd(orasBin, [...args, ...httpArgs], { env })
      } catch (err) {
        if (
          !plainHttp &&
          isPlainHttpMismatch(err) &&
          shouldAttemptPlainHttpFallback(registry)
        ) {
          plainHttp = true
          return spawnCmd(orasBin, [...args, "--plain-http"], { env })
        }
        throw err
      }
    }

    let digest
    try {
      // `oras` (cobra) interprets everything after `--` as positional, which
      // would swallow the `--plain-http` flag appended in runOras. We rely on
      // the constructor's `rejectOptionLikeArg` checks instead — `ref` cannot
      // start with `-` since registry/repo/tag/digest are all validated.
      await runOras(["pull", "--output", tmpDir, ref])
      digest = await readPulledDigest(tmpDir)
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      throw err
    }

    try {
      await fs.rename(tmpDir, dir)
    } catch (err) {
      if (err.code === "ENOTEMPTY" || err.code === "EEXIST") {
        await fs.rm(tmpDir, { recursive: true, force: true })
      } else {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        throw err
      }
    }
    return { dir, digest }
  })()

  artifactCache.set(cacheKey, work)
  try {
    const entry = await work
    artifactCache.set(cacheKey, entry)
    return entry
  } catch (err) {
    artifactCache.delete(cacheKey)
    throw err
  }
}

// Matches `@<algo>:<hex>` digest suffix per OCI spec — algo is alnum / `_+.-`
// (sha256 in practice; spec allows registries to publish others).
const DIGEST_RE = /@([a-zA-Z0-9_+.-]+:[a-fA-F0-9]+)$/

class OciSource extends Source {
  constructor({
    registry,
    repo,
    tag,
    digest,
    filePath,
    defaultExtension = ".dockerfile",
  }) {
    super()
    if (!tag && !digest) {
      throw new Error(
        `OciSource requires either a tag or a digest (got neither for ${registry}/${repo})`,
      )
    }
    rejectOptionLikeArg(registry, "registry")
    rejectOptionLikeArg(repo, "repo")
    if (tag) rejectOptionLikeArg(tag, "tag")
    if (digest) rejectOptionLikeArg(digest, "digest")
    this._registry = registry
    this._repo = repo
    this._tag = tag || null
    // When digest is supplied at parse time, treat it as the immutable identity
    // and skip `resolve()`. `key()` uses it directly so cycles are detected
    // without an extra round-trip.
    this._digest = digest || null
    this._filePath = sanitizeRelativePath(
      filePath,
      `oci://${registry}/${repo}${tag ? `:${tag}` : `@${digest}`}#${filePath}`,
    )
    this._defaultExtension = defaultExtension
  }

  static parse(reference, { defaultExtension } = {}) {
    const stripped = reference.replace(/^oci:\/\//i, "")
    const hashIdx = stripped.indexOf("#")
    if (hashIdx === -1) {
      throw new Error(
        `Invalid oci source ${reference}: expected oci://<registry>/<repo>(:<tag>|@<digest>)#<path>`,
      )
    }
    const before = stripped.slice(0, hashIdx)
    const filePath = stripped.slice(hashIdx + 1)

    const slashIdx = before.indexOf("/")
    if (slashIdx === -1) {
      throw new Error(
        `Invalid oci source ${reference}: expected oci://<registry>/<repo>(:<tag>|@<digest>)#<path>`,
      )
    }
    const registry = before.slice(0, slashIdx)
    const repoTagOrDigest = before.slice(slashIdx + 1)

    // Digest-pinned form takes precedence: `@<algo>:<hex>` is unambiguous and
    // an OCI digest always contains a colon, so a naive lastIndexOf(":") would
    // mis-split it as repo+tag.
    const digestMatch = repoTagOrDigest.match(DIGEST_RE)
    if (digestMatch) {
      const repo = repoTagOrDigest.slice(0, digestMatch.index)
      if (!repo) {
        throw new Error(
          `Invalid oci source ${reference}: missing repo before digest`,
        )
      }
      return new OciSource({
        registry,
        repo,
        digest: digestMatch[1],
        filePath,
        defaultExtension,
      })
    }

    const colonIdx = repoTagOrDigest.lastIndexOf(":")
    if (colonIdx === -1) {
      throw new Error(
        `Invalid oci source ${reference}: expected oci://<registry>/<repo>(:<tag>|@<digest>)#<path>`,
      )
    }
    const repo = repoTagOrDigest.slice(0, colonIdx)
    const tag = repoTagOrDigest.slice(colonIdx + 1)
    return new OciSource({ registry, repo, tag, filePath, defaultExtension })
  }

  // Reference suitable for `oras` invocations: `<registry>/<repo>@<digest>`
  // when pinned, otherwise `<registry>/<repo>:<tag>`.
  _orasRef() {
    return this._digest
      ? `${this._registry}/${this._repo}@${this._digest}`
      : `${this._registry}/${this._repo}:${this._tag}`
  }

  async resolve() {
    // Already pinned (digest-form ref) — no round-trip needed.
    if (this._digest) return
    const ref = this._orasRef()
    let p = digestResolveCache.get(ref)
    if (!p) {
      p = (async () => {
        const orasBin = findOrasBin()
        const dockerConfigDir = await resolveDockerConfigDir()
        const env = {
          ...process.env,
          ...(dockerConfigDir ? { DOCKER_CONFIG: dockerConfigDir } : {}),
        }
        let plainHttp = shouldUsePlainHttp(this._registry)
        // oras cobra parses everything after `--` as positional, so we can't
        // use it here — `extra` may carry `--plain-http`. Constructor already
        // rejects refs whose first byte is `-`, so positional placement is safe.
        const buildArgs = (extra) => [
          "manifest",
          "fetch",
          "--descriptor",
          ...extra,
          ref,
        ]
        const tryRun = async (extra) => {
          try {
            return await spawnCmd(orasBin, buildArgs(extra), { env })
          } catch (err) {
            if (
              extra.length === 0 &&
              !plainHttp &&
              isPlainHttpMismatch(err) &&
              shouldAttemptPlainHttpFallback(this._registry)
            ) {
              plainHttp = true
              return spawnCmd(orasBin, buildArgs(["--plain-http"]), { env })
            }
            throw err
          }
        }
        const { stdout } = await tryRun(plainHttp ? ["--plain-http"] : [])
        let desc
        try {
          desc = JSON.parse(stdout)
        } catch {
          throw new Error(
            `oras manifest fetch --descriptor ${ref}: could not parse digest`,
          )
        }
        assertValidDigest(desc?.digest, `oras manifest fetch ${ref}`)
        return desc.digest
      })()
      digestResolveCache.set(ref, p)
      p.catch(() => digestResolveCache.delete(ref))
    }
    this._digest = await p
  }

  async _resolveFile() {
    const tagOrDigest = this._digest ? `@${this._digest}` : `:${this._tag}`
    const entry = await ensureArtifact(this._registry, this._repo, tagOrDigest)
    if (entry.digest) this._digest = entry.digest

    const tryPath = async (rel) => {
      const full = path.resolve(entry.dir, rel)
      // Lexical check first (cheap), then realpath check to catch symlinks
      // inside the artifact that point outside the cache dir.
      assertContained(entry.dir, full, this.displayPath())
      try {
        await fs.access(full)
      } catch {
        return null
      }
      await assertContainedReal(entry.dir, full, this.displayPath())
      return rel
    }

    const resolved = await tryWithExtension(
      this._filePath,
      this._defaultExtension,
      tryPath,
    )
    if (!resolved) {
      throw new RemoteFileNotFoundError(this.displayPath())
    }
    return { dir: entry.dir, filePath: resolved }
  }

  async read() {
    const { dir, filePath } = await this._resolveFile()
    return fs.readFile(path.join(dir, filePath), "utf-8")
  }

  joinRelative(relPath) {
    const newPath = path.posix.join(
      path.posix.dirname(this._filePath),
      relPath,
    )
    const child = new OciSource({
      registry: this._registry,
      repo: this._repo,
      tag: this._tag,
      digest: this._digest,
      filePath: newPath,
      defaultExtension: this._defaultExtension,
    })
    return child
  }

  key() {
    const ident = this._digest ? `@${this._digest}` : `:${this._tag}`
    return `oci://${this._registry}/${this._repo}${ident}#${this._filePath}`
  }

  displayPath() {
    const ident = this._digest ? `@${this._digest}` : `:${this._tag}`
    return `oci://${this._registry}/${this._repo}${ident}#${this._filePath}`
  }

  stageAliasBase() {
    return this.key()
  }
}

module.exports = OciSource
module.exports.ociCacheRoot = ociCacheRoot
module.exports.resolveDockerConfigDir = resolveDockerConfigDir
module.exports.assertValidDigest = assertValidDigest
