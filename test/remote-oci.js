const path = require("path")
const fs = require("fs/promises")
const fssync = require("fs")
const os = require("os")
const net = require("net")
const { spawn, execFileSync } = require("child_process")
const { expect } = require("chai")

let registryName
let registryPort
let workDir
let ociCacheDir
let orasBin

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

function dockerOk() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function orasPath() {
  if (process.env.DOCKERFILEX_ORAS_BIN) return process.env.DOCKERFILEX_ORAS_BIN
  const home = process.env.HOME || ""
  const candidate = path.join(home, ".local/bin/oras")
  if (fssync.existsSync(candidate)) return candidate
  return "oras"
}

function waitForRegistry(port, timeoutMs = 30000) {
  const http = require("http")
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/v2/", timeout: 1000 },
        (res) => {
          res.resume()
          // 200 or 401 means the v2 API is up
          if (res.statusCode === 200 || res.statusCode === 401) {
            resolve()
          } else if (Date.now() - start > timeoutMs) {
            reject(
              new Error(`registry up but unexpected status ${res.statusCode}`),
            )
          } else {
            setTimeout(tick, 250)
          }
        },
      )
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("registry never came up"))
        } else {
          setTimeout(tick, 250)
        }
      })
      req.on("timeout", () => req.destroy())
    }
    tick()
  })
}

before(async function startRegistry() {
  this.timeout(30000)
  if (!dockerOk()) {
    this.skip()
  }
  orasBin = orasPath()
  if (orasBin === "oras") {
    try {
      execFileSync("oras", ["version"], { stdio: "ignore" })
    } catch {
      this.skip()
    }
  }
  registryPort = await pickFreePort()
  registryName = `dfx-test-registry-${registryPort}`
  // Run registry:2 detached
  execFileSync("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    registryName,
    "-p",
    `${registryPort}:5000`,
    "registry:2",
  ])
  await waitForRegistry(registryPort)

  workDir = await fs.mkdtemp(path.join(os.tmpdir(), "dfx-oci-work-"))
  ociCacheDir = path.join(workDir, "cache")

  // Stage two dockerfiles in a subdir to test recursion within an OCI artifact
  await fs.mkdir(path.join(workDir, "inc"), { recursive: true })
  await fs.writeFile(
    path.join(workDir, "inc/base.dockerfile"),
    "FROM alpine:3.19\nRUN echo oci-base\n",
  )
  await fs.writeFile(
    path.join(workDir, "inc/app.dockerfile"),
    "INCLUDE base.dockerfile\nRUN echo oci-app\n",
  )

  // Push as a single artifact with two files (relative paths preserved)
  const ref = `127.0.0.1:${registryPort}/test:v1`
  execFileSync(
    orasBin,
    [
      "push",
      "--plain-http",
      ref,
      "inc/base.dockerfile:application/vnd.dockerfile",
      "inc/app.dockerfile:application/vnd.dockerfile",
    ],
    { cwd: workDir, stdio: "inherit" },
  )

  process.env.DOCKERFILEX_OCI_CACHE_DIR = ociCacheDir
  process.env.DOCKERFILEX_ORAS_BIN = orasBin
})

after(async function teardown() {
  this.timeout(10000)
  try {
    if (registryName) {
      execFileSync("docker", ["rm", "-f", registryName], { stdio: "ignore" })
    }
  } catch {
    /* noop */
  }
  if (workDir) await fs.rm(workDir, { recursive: true, force: true })
  delete process.env.DOCKERFILEX_OCI_CACHE_DIR
  delete process.env.DOCKERFILEX_ORAS_BIN
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

describe("OCI source", () => {
  it("INCLUDE oci:// pulls a file from an OCI artifact", async () => {
    const ref = `oci://127.0.0.1:${registryPort}/test:v1#inc/base.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("FROM alpine:3.19")
    expect(out).to.include("RUN echo oci-base")
  })

  it("INCLUDE recurses inside an OCI artifact via relative path", async () => {
    const ref = `oci://127.0.0.1:${registryPort}/test:v1#inc/app.dockerfile`
    const dockerfile = `# syntax = devthefuture/dockerfile-x\nINCLUDE ${ref}\n`
    const out = await runCli(dockerfile)
    expect(out).to.include("RUN echo oci-base")
    expect(out).to.include("RUN echo oci-app")
  })
})
