const http = require("http")
const path = require("path")
const fs = require("fs/promises")
const os = require("os")
const { spawn } = require("child_process")
const { expect } = require("chai")

let server
let baseUrl
let cacheDir

before(async () => {
  cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "dockerfile-x-cache-"))
  process.env.DOCKERFILEX_CACHE_DIR = cacheDir

  const fixturesDir = path.resolve(__dirname, "fixtures/inc")
  server = http.createServer(async (req, res) => {
    try {
      const url = req.url.split("?")[0]
      // Special route for redirect-handling test: /redirect-to/<rest> -> 301 -> /<rest>
      const redirectMatch = url.match(/^\/redirect-to\/(.+)$/)
      if (redirectMatch) {
        res.statusCode = 301
        res.setHeader("Location", `/${redirectMatch[1]}`)
        res.end()
        return
      }
      // Redirect to an external URL with a different scheme (used to verify
      // beforeRedirect guard). The .dockerfile suffix is required so
      // HttpSource doesn't auto-append it and miss this route.
      if (url === "/redirect-to-file.dockerfile") {
        res.statusCode = 301
        res.setHeader("Location", "file:///etc/passwd")
        res.end()
        return
      }
      // Cross-host redirect to a literal RFC1918 IP — used to verify the
      // SSRF guard rejects without DOCKERFILEX_REDIRECT_ALLOWLIST.
      if (url === "/redirect-to-private.dockerfile") {
        res.statusCode = 301
        res.setHeader("Location", "http://10.255.255.255:1/x.dockerfile")
        res.end()
        return
      }
      // Cross-host redirect to AWS-style cloud metadata IP. Same SSRF guard
      // path; pinned separately because 169.254.169.254 is the canonical
      // example of the threat.
      if (url === "/redirect-to-metadata.dockerfile") {
        res.statusCode = 301
        res.setHeader("Location", "http://169.254.169.254/latest/")
        res.end()
        return
      }
      // Returns a Content-Length larger than the configured max — used to
      // verify the body-size guard rejects oversize payloads.
      if (url === "/oversize.dockerfile") {
        const big = "X".repeat(50 * 1024 * 1024) // 50 MiB
        res.setHeader("Content-Type", "text/plain")
        res.setHeader("Content-Length", String(Buffer.byteLength(big)))
        res.end(big)
        return
      }
      const safe = url.replace(/^\/+/, "")
      const target = path.join(fixturesDir, safe)
      if (!target.startsWith(fixturesDir)) {
        res.statusCode = 403
        res.end("forbidden")
        return
      }
      const data = await fs.readFile(target, "utf-8")
      res.setHeader("Content-Type", "text/plain")
      res.end(data)
    } catch (err) {
      if (err.code === "ENOENT") {
        res.statusCode = 404
        res.end("not found")
      } else {
        res.statusCode = 500
        res.end(String(err))
      }
    }
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}`
})

after(async () => {
  if (server) await new Promise((r) => server.close(r))
  if (cacheDir) await fs.rm(cacheDir, { recursive: true, force: true })
  delete process.env.DOCKERFILEX_CACHE_DIR
})

function runCli(input) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      ["index.js", "-c", "test/fixtures", "-f", "-"],
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

describe("HTTP source", () => {
  it("INCLUDE fetches a remote dockerfile", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/ubuntu.dockerfile\n`
    const out = await runCli(dockerfile)
    expect(out).to.include(`file="${baseUrl}/ubuntu.dockerfile"`)
    expect(out).to.include("FROM ubuntu:")
    expect(out).to.include("ENV HOME=/home/ubuntu")
  })

  it("FROM fetches a remote dockerfile and aliases its final stage", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nFROM ${baseUrl}/ubuntu.dockerfile AS my-base\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("FROM ubuntu:")
    expect(out).to.match(/AS my-base/)
  })

  it("recursive INCLUDE inside a remote dockerfile resolves relative URLs", async () => {
    // downloader.dockerfile contains `INCLUDE ubuntu.dockerfile` — the relative
    // path must URL-join against the parent URL and successfully fetch ubuntu's content.
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/downloader.dockerfile\n`
    const out = await runCli(dockerfile)
    expect(out).to.include(`file="${baseUrl}/downloader.dockerfile"`)
    expect(out).to.include(
      `includedBy="${baseUrl}/downloader.dockerfile"`,
    )
    expect(out).to.include("ENV HOME=/home/ubuntu") // proves ubuntu.dockerfile body was inlined
    expect(out).to.include("apt-get install") // proves downloader's tail also rendered
  })

  it("rejects 404 with a non-zero exit", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/does-not-exist.dockerfile\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit").to.exist
  })

  it("relative INCLUDE with ../ stays bounded to the same host", async () => {
    // subdir/traverse.dockerfile contains `INCLUDE ../../../etc/passwd`. URL
    // semantics cap traversal at the origin root, so the resolved URL is
    // `http://host:port/etc/passwd.dockerfile` (HttpSource auto-appends the
    // default extension), which the test server 404s. Critically, no local
    // /etc/passwd is read — HttpSource only fetches over HTTP.
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/subdir/traverse.dockerfile\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on traversal").to.exist
    const payload = JSON.parse(err.stdout)
    expect(payload.error).to.equal("remote-file-not-found")
    // Stays on the same host; never escapes to a file:// path or another origin.
    expect(payload.ref).to.match(
      new RegExp(`^${baseUrl.replace(/[.]/g, "\\.")}/etc/passwd`),
    )
    // `filename` must NOT be present — that key triggers the Go frontend's
    // local-file LLB retry, which is meaningless for a URL.
    expect(payload).to.not.have.property("filename")
  })

  it("follows HTTP redirects (3xx) when fetching a remote dockerfile", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/redirect-to/ubuntu.dockerfile\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("FROM ubuntu:")
    expect(out).to.include("ENV HOME=/home/ubuntu")
  })

  it("INCLUDE_ARGS fetches a remote .env and emits ARG instructions", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE_ARGS ${baseUrl}/custom-args.env\nFROM alpine:3\n`
    const out = await runCli(dockerfile)
    expect(out).to.include('ARG BASIC="basic"')
    expect(out).to.include('ARG AFTER_LINE="after_line"')
  })

  it("INCLUDE_ENVS fetches a remote .env and emits ENV instructions", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE_ENVS ${baseUrl}/custom-args.env\nFROM alpine:3\n`
    const out = await runCli(dockerfile)
    expect(out).to.include('ENV BASIC="basic"')
  })

  it("rejects an oversized response body", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/oversize.dockerfile\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on oversize body").to.exist
    // Surfaces as a generic remote-fetch-failed (axios maxContentLength error
    // doesn't carry a 4xx response, so it's not a remote-file-not-found).
    const payload = JSON.parse(err.stdout)
    expect(payload.error).to.equal("remote-fetch-failed")
  })

  it("refuses redirect to a non-http(s) scheme (file://)", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/redirect-to-file\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on file:// redirect").to.exist
    const payload = JSON.parse(err.stdout)
    expect(payload.error).to.equal("remote-fetch-failed")
    // The local /etc/passwd MUST never appear in the error or output —
    // the redirect must be refused before any read of file:// is attempted.
    expect(err.stdout + err.stderr).to.not.include("root:")
  })

  it("refuses cross-host redirect to a private IP (SSRF guard)", async () => {
    // Without DOCKERFILEX_REDIRECT_ALLOWLIST set, a redirect from the test
    // server (127.0.0.1:PORT) to 10.255.255.255:1 (RFC1918, different host)
    // must be refused before any connection to the private IP is attempted.
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/redirect-to-private.dockerfile\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on private-IP redirect").to.exist
    const payload = JSON.parse(err.stdout)
    expect(payload.error).to.equal("remote-fetch-failed")
    expect(payload.message).to.match(/private IP|cross-host redirect/i)
  })

  it("refuses cross-host redirect to cloud-metadata IP (169.254.169.254)", async () => {
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/redirect-to-metadata.dockerfile\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on metadata-IP redirect").to.exist
    const payload = JSON.parse(err.stdout)
    expect(payload.error).to.equal("remote-fetch-failed")
  })

  it("detects a cycle when an HTTP source includes itself recursively", async () => {
    // http-cycle.dockerfile contains `INCLUDE ./http-cycle.dockerfile`, which
    // resolves to the same HTTP URL — a one-step self-cycle. This exercises
    // cycle detection across the HTTP source's `key()`.
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${baseUrl}/http-cycle.dockerfile\n`
    let err
    try {
      await runCli(dockerfile)
    } catch (e) {
      err = e
    }
    expect(err, "expected non-zero exit on cycle").to.exist
    const payload = JSON.parse(err.stdout)
    expect(payload.error).to.equal("include-cycle")
    expect(payload.chain).to.be.an("array").with.length.greaterThan(0)
    expect(payload.chain.some((k) => k.includes("http-cycle.dockerfile"))).to.equal(true)
  })
})
