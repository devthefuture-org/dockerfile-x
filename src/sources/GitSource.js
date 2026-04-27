const path = require("path")
const fs = require("fs/promises")
const os = require("os")

const Source = require("./Source")
const spawnCmd = require("../lib/spawnCmd")
const ensureDir = require("../utils/ensureDir")
const shortHash = require("../utils/shortHash")
const tryWithExtension = require("./tryWithExtension")
const assertContained = require("./assertContained")
const { assertContainedReal } = require("./assertContained")
const sanitizeRelativePath = require("./sanitizeRelativePath")
const RemoteFileNotFoundError = require("../errors/RemoteFileNotFoundError")

const repoCache = new Map() // resolved entries OR in-flight Promise<entry>
const refResolveCache = new Map() // `${repo}#${ref}` -> Promise<oid>

function gitCacheRoot() {
  return (
    process.env.DOCKERFILEX_GIT_CACHE_DIR ||
    path.join(os.homedir(), ".dockerfile-x", "git-cache")
  )
}

// Reject repo URLs / refs that would be parsed as an option flag by git when
// passed positionally. Even though execFile bypasses the shell, git's own
// option parser still interprets a leading `--option` (CVE-2017-1000117 class:
// e.g. `--upload-pack=cmd` triggers RCE). We additionally pass `--` as the
// end-of-options separator below, but reject up front for clearer errors.
function rejectOptionLikeArg(value, kind) {
  if (typeof value === "string" && value.startsWith("-")) {
    throw new Error(
      `Invalid git ${kind}: ${value} (must not start with '-' to avoid being parsed as a flag)`,
    )
  }
}

// SHA-1 (40 hex) or SHA-256 (64 hex). Pinning to a raw commit takes a
// different fetch path because `git clone --branch` rejects SHAs.
const SHA_RE = /^([0-9a-f]{40}|[0-9a-f]{64})$/i
function isShaRef(ref) {
  return typeof ref === "string" && SHA_RE.test(ref)
}

async function ensureRepo(repo, ref) {
  const cacheKey = `${repo}#${ref}`
  // Cache may hold either the resolved entry or an in-flight Promise — second
  // concurrent caller awaits the first one's clone instead of racing it.
  const cached = repoCache.get(cacheKey)
  if (cached) return cached

  const work = (async () => {
    const root = gitCacheRoot()
    await ensureDir(root)
    const dir = path.join(root, `${shortHash(repo)}-${shortHash(ref)}`)

    // Already populated by an earlier (or concurrent) process? Reuse it.
    let oid
    try {
      const { stdout } = await spawnCmd("git", ["-C", dir, "rev-parse", "HEAD"])
      oid = stdout.trim()
      if (oid) return { dir, oid, sparseSet: new Set() }
    } catch {
      /* fall through: not a populated cache dir */
    }

    // Clone into a unique tmp dir, then rename into place. The rename is
    // atomic on the same fs *only* when `dir` doesn't already exist; the
    // ENOTEMPTY/EEXIST fallback below covers the lost-race case where another
    // process populated `dir` first.
    const tmpDir = `${dir}.tmp-${process.pid}-${Date.now()}`
    await fs.rm(tmpDir, { recursive: true, force: true })

    if (isShaRef(ref)) {
      // SHA refs can't go through `clone --branch` (git rejects raw oids).
      // Modern servers (GitHub/GitLab; self-hosted with
      // `uploadpack.allowReachableSHA1InWant=true`) accept fetch-by-oid via
      // protocol v2, which lets us still get a depth-1 + filter=blob:none
      // tree. Init an empty repo, add origin, fetch the SHA, then move on.
      await ensureDir(tmpDir)
      await spawnCmd("git", ["-C", tmpDir, "init", "--quiet"])
      await spawnCmd("git", [
        "-C",
        tmpDir,
        "remote",
        "add",
        "origin",
        "--",
        repo,
      ])
      await spawnCmd("git", [
        "-C",
        tmpDir,
        "-c",
        "protocol.version=2",
        "fetch",
        "--depth",
        "1",
        "--filter=blob:none",
        "--no-tags",
        "origin",
        "--",
        ref,
      ])
      // FETCH_HEAD is the oid we just asked for; record it without an extra
      // network hop.
      oid = ref.toLowerCase()
      // Detach HEAD to FETCH_HEAD so subsequent `git checkout` materializes
      // sparse-checkout patterns from the right tree.
      await spawnCmd("git", [
        "-C",
        tmpDir,
        "update-ref",
        "--no-deref",
        "HEAD",
        "FETCH_HEAD",
      ])
      await spawnCmd("git", [
        "-C",
        tmpDir,
        "sparse-checkout",
        "init",
        "--cone",
      ])
    } else {
      // --filter=blob:none + --no-checkout: fetch the tree only, blobs come on
      // demand when sparse-checkout materializes the requested directory.
      // `--` ends git's option parsing so an attacker-controlled `repo` (e.g.
      // `--upload-pack=cmd`) can't masquerade as a flag.
      await spawnCmd("git", [
        "clone",
        "--depth",
        "1",
        "--filter=blob:none",
        "--no-checkout",
        "--single-branch",
        "--branch",
        ref,
        "--",
        repo,
        tmpDir,
      ])
      await spawnCmd("git", [
        "-C",
        tmpDir,
        "sparse-checkout",
        "init",
        "--cone",
      ])
      const { stdout } = await spawnCmd("git", [
        "-C",
        tmpDir,
        "rev-parse",
        "HEAD",
      ])
      oid = stdout.trim()
    }

    try {
      await fs.rename(tmpDir, dir)
    } catch (err) {
      // ENOTEMPTY/EEXIST: another process won the race and populated `dir`.
      // Discard our copy and use theirs.
      if (err.code === "ENOTEMPTY" || err.code === "EEXIST") {
        await fs.rm(tmpDir, { recursive: true, force: true })
      } else {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        throw err
      }
    }
    return { dir, oid, sparseSet: new Set() }
  })()

  repoCache.set(cacheKey, work)
  try {
    const entry = await work
    repoCache.set(cacheKey, entry)
    return entry
  } catch (err) {
    repoCache.delete(cacheKey)
    throw err
  }
}

async function ensurePath(entry, filePath) {
  // Cone mode takes directory paths, not file globs.
  const parentDir = path.posix.dirname(filePath)
  const sparseArg = parentDir === "." || parentDir === "/" ? "" : parentDir
  if (entry.sparseSet.has(sparseArg)) return

  // Serialize concurrent ensurePath calls on the same entry so two callers
  // can't race on `sparse-checkout set` / `checkout`.
  if (!entry.inflightPaths) entry.inflightPaths = new Map()
  let p = entry.inflightPaths.get(sparseArg)
  if (!p) {
    p = (async () => {
      if (sparseArg) {
        // `--` terminates option parsing for the cone-mode pattern list.
        await spawnCmd("git", [
          "-C",
          entry.dir,
          "sparse-checkout",
          "set",
          "--",
          sparseArg,
        ])
      } else {
        // Cone mode rejects an empty pattern set; disable sparse-checkout to
        // materialize the top-level files.
        await spawnCmd("git", ["-C", entry.dir, "sparse-checkout", "disable"])
      }
      await spawnCmd("git", ["-C", entry.dir, "checkout"])
      entry.sparseSet.add(sparseArg)
    })()
    entry.inflightPaths.set(sparseArg, p)
    p.finally(() => entry.inflightPaths.delete(sparseArg))
  }
  await p
}

class GitSource extends Source {
  constructor({ repo, ref, filePath, defaultExtension = ".dockerfile" }) {
    super()
    rejectOptionLikeArg(repo, "repo URL")
    rejectOptionLikeArg(ref, "ref")
    this._repo = repo
    this._ref = ref
    this._filePath = sanitizeRelativePath(
      filePath,
      `git+${repo}#${ref}:${filePath}`,
    )
    this._defaultExtension = defaultExtension
    this._oid = null
  }

  static parse(reference, { defaultExtension } = {}) {
    const stripped = reference.replace(/^git\+/i, "")
    const hashIdx = stripped.indexOf("#")
    if (hashIdx === -1) {
      throw new Error(
        `Invalid git source ${reference}: expected git+<git-url>#<ref>:<path>`,
      )
    }
    const repo = stripped.slice(0, hashIdx)
    const fragment = stripped.slice(hashIdx + 1)
    const colonIdx = fragment.indexOf(":")
    if (colonIdx === -1) {
      throw new Error(
        `Invalid git source ${reference}: expected git+<git-url>#<ref>:<path>`,
      )
    }
    const ref = fragment.slice(0, colonIdx)
    const filePath = fragment.slice(colonIdx + 1)
    return new GitSource({ repo, ref, filePath, defaultExtension })
  }

  async resolve() {
    if (this._oid) return
    // Already pinned to an immutable SHA — no ls-remote round-trip needed.
    if (isShaRef(this._ref)) {
      this._oid = this._ref.toLowerCase()
      return
    }
    const cacheKey = `${this._repo}#${this._ref}`
    let p = refResolveCache.get(cacheKey)
    if (!p) {
      p = (async () => {
        // `--` ends option parsing — guards against `--upload-pack=cmd` style
        // injection if `repo` ever contains attacker-controlled bytes.
        const { stdout } = await spawnCmd("git", [
          "ls-remote",
          "--",
          this._repo,
          this._ref,
        ])
        const line = stdout.split("\n").find(Boolean) || ""
        const oid = line.split(/\s+/)[0]
        // git ls-remote always returns a full SHA-1 (40 hex) or SHA-256 (64
        // hex). Rejecting anything else keeps cycle keys collision-resistant
        // and rejects a malformed (or attacker-emulated) git server response.
        if (!oid || !/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(oid)) {
          throw new Error(
            `git ls-remote ${this._repo} ${this._ref}: could not resolve oid`,
          )
        }
        return oid
      })()
      refResolveCache.set(cacheKey, p)
      p.catch(() => refResolveCache.delete(cacheKey))
    }
    this._oid = await p
  }

  async _resolveFile() {
    const entry = await ensureRepo(this._repo, this._ref)
    this._oid = entry.oid

    const tryPath = async (candidate) => {
      const full = path.resolve(entry.dir, candidate)
      // Lexical check first (cheap, catches the common case before any IO).
      assertContained(entry.dir, full, this.displayPath())
      await ensurePath(entry, candidate)
      try {
        await fs.access(full)
      } catch {
        return null
      }
      // Realpath check after materialization: a symlink inside the repo could
      // legitimately resolve under entry.dir (lexical check passes) but point
      // outside via fs.realpath. Reject those.
      await assertContainedReal(entry.dir, full, this.displayPath())
      return candidate
    }

    const resolved = await tryWithExtension(
      this._filePath,
      this._defaultExtension,
      tryPath,
    )
    if (!resolved) {
      throw new RemoteFileNotFoundError(
        `${this._repo}#${this._ref}:${this._filePath}`,
      )
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
    const child = new GitSource({
      repo: this._repo,
      ref: this._ref,
      filePath: newPath,
      defaultExtension: this._defaultExtension,
    })
    child._oid = this._oid
    return child
  }

  key() {
    const ident = this._oid || this._ref
    return `git+${this._repo}#${ident}:${this._filePath}`
  }

  displayPath() {
    return `git+${this._repo}#${this._ref}:${this._filePath}`
  }

  stageAliasBase() {
    return this.key()
  }
}

module.exports = GitSource
module.exports.gitCacheRoot = gitCacheRoot
