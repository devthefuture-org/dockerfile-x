const path = require("path")
const fs = require("fs/promises")
const fssync = require("fs")
const os = require("os")
const { spawn, execFileSync } = require("child_process")
const { expect } = require("chai")

let bareRepo
let workRepo
let gitCacheDir
let mainCommitSha

before(async () => {
  // Build a bare repo with two dockerfiles in a subdir to exercise sparse-checkout
  // and recursive INCLUDE within the same git source.
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dfx-git-"))
  bareRepo = path.join(tmpRoot, "remote.git")
  workRepo = path.join(tmpRoot, "work")
  gitCacheDir = path.join(tmpRoot, "cache")

  await fs.mkdir(workRepo, { recursive: true })

  const run = (args, opts = {}) =>
    execFileSync("git", args, {
      cwd: workRepo,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
      ...opts,
    })

  run(["init", "-b", "main"])
  run(["config", "commit.gpgsign", "false"])

  await fs.mkdir(path.join(workRepo, "inc"), { recursive: true })
  await fs.writeFile(
    path.join(workRepo, "inc/base.dockerfile"),
    "FROM alpine:3.19\nRUN echo base\n",
  )
  await fs.writeFile(
    path.join(workRepo, "inc/app.dockerfile"),
    "INCLUDE base.dockerfile\nRUN echo app\n",
  )
  await fs.writeFile(
    path.join(workRepo, "top.dockerfile"),
    "FROM alpine:3.19\nRUN echo top\n",
  )
  // Symlink whose target points outside the repo. Used by the path-traversal
  // test to verify assertContainedReal rejects checked-out symlinks that
  // resolve outside the cache directory.
  await fs.symlink(
    "/etc/passwd",
    path.join(workRepo, "inc/escape.dockerfile"),
  )

  run(["add", "."])
  run(["commit", "-m", "init"])
  // Capture the main-branch commit SHA before cloning bare so the SHA-pinning
  // test can target it. `git rev-parse main` returns the full 40-hex SHA-1.
  mainCommitSha = execFileSync("git", ["rev-parse", "main"], {
    cwd: workRepo,
  })
    .toString()
    .trim()
  // Create bare clone for "remote"
  execFileSync("git", ["clone", "--bare", workRepo, bareRepo])
  // Allow the bare repo to serve fetch-by-oid via protocol v2. file:// repos
  // need this off (or `uploadpack.allowAnySHA1InWant=true`) to accept a SHA
  // ref in `git fetch`. GitHub/GitLab.com/Gitea allow this by default.
  execFileSync("git", [
    "-C",
    bareRepo,
    "config",
    "uploadpack.allowAnySHA1InWant",
    "true",
  ])

  process.env.DOCKERFILEX_GIT_CACHE_DIR = gitCacheDir
})

after(async () => {
  if (gitCacheDir && fssync.existsSync(gitCacheDir)) {
    await fs.rm(gitCacheDir, { recursive: true, force: true })
  }
  delete process.env.DOCKERFILEX_GIT_CACHE_DIR
})

function runCli(input, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      ["index.js", "-c", "test/fixtures", "-f", "-", ...extraArgs],
      { stdio: ["pipe", "pipe", "pipe"] },
    )
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => {
      stdout += d
    })
    child.stderr.on("data", (d) => {
      stderr += d
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) {
        const err = new Error(`CLI exited ${code}\n${stderr}\n${stdout}`)
        err.code = code
        err.stdout = stdout
        err.stderr = stderr
        reject(err)
      } else {
        resolve(stdout)
      }
    })
    child.stdin.write(input)
    child.stdin.end()
  })
}

describe("Git source", () => {
  it("INCLUDE git+file:// fetches a file from a sparse clone", async () => {
    const ref = `git+file://${bareRepo}#main:inc/base.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("FROM alpine:3.19")
    expect(out).to.include("RUN echo base")
  })

  it("INCLUDE recurses inside the same git source via relative path", async () => {
    const ref = `git+file://${bareRepo}#main:inc/app.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("RUN echo base") // proves base.dockerfile body got pulled
    expect(out).to.include("RUN echo app")
  })

  it("FROM git+file:// uses the included file as a base", async () => {
    const ref = `git+file://${bareRepo}#main:top.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nFROM ${ref} AS the-base\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("FROM alpine:3.19")
    expect(out).to.match(/AS the-base/)
  })

  it("CLI rejects a git ref starting with `-` (option-like) before invoking git", async () => {
    // Constructor-level rejectOptionLikeArg is unit-tested in path-traversal.js;
    // this test pins that the CLI surfaces the error instead of crashing or
    // leaking the rejection beyond the structured-error contract. We use a
    // sentinel file to also confirm git is never invoked: the option-like
    // ref `--upload-pack=touch SENTINEL` would create the file if a future
    // refactor dropped the rejectOptionLikeArg guard AND `--` separator.
    const sentinel = path.join(
      os.tmpdir(),
      `dfx-arginj-sentinel-${process.pid}-${Date.now()}`,
    )
    const ref = `git+file://${bareRepo}#--upload-pack=touch ${sentinel}:inc/base.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on option-like ref").to.exist
    let touched = false
    try {
      await fs.access(sentinel)
      touched = true
      await fs.unlink(sentinel).catch(() => {})
    } catch {
      /* expected: sentinel does not exist */
    }
    expect(touched, "sentinel file must not exist — git was invoked!").to.equal(false)
  })

  it("rejects a checked-out symlink that resolves outside the repo", async () => {
    // inc/escape.dockerfile is a symlink to /etc/passwd inside the repo. The
    // lexical containment check passes (path is under entry.dir), but
    // assertContainedReal must catch it after realpath() follows the symlink.
    const ref = `git+file://${bareRepo}#main:inc/escape.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on symlink escape").to.exist
    const payload = JSON.parse(err.stdout)
    expect(payload.error).to.equal("path-traversal")
    // The contents of /etc/passwd MUST never appear in the output — the
    // symlink must be refused before fs.readFile follows it.
    expect(err.stdout + err.stderr).to.not.include("root:")
  })

  it("does not shell-expand metacharacters in the git ref (no execFile→shell regression)", async () => {
    // If a future refactor swapped execFile for `exec` or set `shell: true`,
    // this ref would `touch` the sentinel before git rejected it. The test
    // asserts the CLI fails AND no shell expansion occurred.
    const sentinel = path.join(
      os.tmpdir(),
      `dfx-shell-sentinel-${process.pid}-${Date.now()}`,
    )
    const ref = `git+file://${bareRepo}#main; touch ${sentinel}:inc/base.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected CLI to fail on unresolvable ref").to.exist
    let touched = false
    try {
      await fs.access(sentinel)
      touched = true
      await fs.unlink(sentinel).catch(() => {})
    } catch {
      /* expected: sentinel does not exist */
    }
    expect(touched, "sentinel file must not exist — shell expansion happened!").to.equal(false)
  })

  it("INCLUDE git+file:// pins to a raw commit SHA (supply-chain pinning)", async () => {
    // Pinning to a SHA is the strongest defense against an upstream rewrite —
    // a force-push to `main` cannot affect a build that already pinned the
    // SHA. The fetcher takes a different code path (init + fetch <oid> via
    // protocol v2) than the branch/tag clone, so this test exercises both.
    expect(mainCommitSha).to.match(/^[0-9a-f]{40}$/)
    const ref = `git+file://${bareRepo}#${mainCommitSha}:inc/base.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("FROM alpine:3.19")
    expect(out).to.include("RUN echo base")
    // The cycle/display key must carry the SHA, not a branch name.
    expect(out).to.include(mainCommitSha)
  })

  // In-process concurrency test (separate from spawn-based CLI tests above):
  // two parallel resolves of the same ref must share an in-flight clone.
  it("two parallel in-process resolves of the same ref share a single clone", async () => {
    await fs.rm(gitCacheDir, { recursive: true, force: true })

    // Fresh require — the cache map is module-scoped, so re-requiring through
    // a deleted entry from `require.cache` gives us a clean slate.
    const gitSourcePath = require.resolve("../src/sources/GitSource")
    delete require.cache[gitSourcePath]
    const FreshGitSource = require("../src/sources/GitSource")

    const a = new FreshGitSource({
      repo: `file://${bareRepo}`,
      ref: "main",
      filePath: "inc/base.dockerfile",
    })
    const b = new FreshGitSource({
      repo: `file://${bareRepo}`,
      ref: "main",
      filePath: "inc/base.dockerfile",
    })

    const [contentA, contentB] = await Promise.all([a.read(), b.read()])
    expect(contentA).to.include("FROM alpine:3.19")
    expect(contentB).to.include("FROM alpine:3.19")

    const entries = (await fs.readdir(gitCacheDir)).filter(
      (e) => !e.startsWith("."),
    )
    expect(entries).to.have.lengthOf(1)
  })
})
