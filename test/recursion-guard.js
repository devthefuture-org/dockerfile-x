const path = require("path")
const fs = require("fs/promises")
const os = require("os")
const { spawn } = require("child_process")
const { expect } = require("chai")

function runCli(argString, env) {
  return new Promise((resolve) => {
    const args = ["index.js", ...argString.split(" ").filter(Boolean)]
    const child = spawn("node", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => {
      stdout += d
    })
    child.stderr.on("data", (d) => {
      stderr += d
    })
    child.on("close", (code) => resolve({ stdout, stderr, code }))
  })
}

describe("recursion guards", () => {
  it("detects an INCLUDE cycle (a -> b -> a)", async () => {
    const { stdout, code } = await runCli(
      "-c test/fixtures -f cycle-a.dockerfile",
    )
    expect(code).to.equal(2)
    const payload = JSON.parse(stdout)
    expect(payload.error).to.equal("include-cycle")
    expect(payload.chain).to.be.an("array").with.length.greaterThan(1)
  })

  it("enforces --max-include-depth", async () => {
    // chain is deep-1 -> deep-2 -> deep-3 -> deep-4 (4 levels including root).
    // nestingLevel: deep-1=0, deep-2=1, deep-3=2, deep-4=3.
    // With max=2, deep-4 (nestingLevel=3) trips the guard (3 > 2).
    const { stdout, code } = await runCli(
      "-c test/fixtures -f deep-1.dockerfile --max-include-depth 2",
    )
    expect(code).to.equal(2)
    const payload = JSON.parse(stdout)
    expect(payload.error).to.equal("include-depth-exceeded")
    expect(payload.max).to.equal(2)
  })

  it("allows full chain when --max-include-depth is high enough", async () => {
    const { stdout, code } = await runCli(
      "-c test/fixtures -f deep-1.dockerfile --max-include-depth 10",
    )
    expect(code).to.equal(0)
    expect(stdout).to.include("FROM alpine:3")
  })

  it("rejects --max-include-depth 0 as invalid CLI input", async () => {
    const { stderr, code } = await runCli(
      "-c test/fixtures -f deep-1.dockerfile --max-include-depth 0",
    )
    expect(code).to.not.equal(0)
    expect(stderr).to.include("must be a positive integer")
  })

  it("rejects DOCKERFILEX_MAX_INCLUDE_DEPTH=0 the same way as the CLI flag", async () => {
    const { stderr, code } = await runCli(
      "-c test/fixtures -f deep-1.dockerfile",
      { DOCKERFILEX_MAX_INCLUDE_DEPTH: "0" },
    )
    expect(code).to.not.equal(0)
    expect(stderr).to.match(/must be a positive integer/i)
  })

  it("rejects DOCKERFILEX_MAX_INCLUDE_DEPTH=garbage", async () => {
    const { stderr, code } = await runCli(
      "-c test/fixtures -f deep-1.dockerfile",
      { DOCKERFILEX_MAX_INCLUDE_DEPTH: "abc" },
    )
    expect(code).to.not.equal(0)
    expect(stderr).to.match(/must be a positive integer/i)
  })

  it("honors DOCKERFILEX_MAX_INCLUDE_DEPTH env var", async () => {
    const { stdout, code } = await runCli(
      "-c test/fixtures -f deep-1.dockerfile",
      { DOCKERFILEX_MAX_INCLUDE_DEPTH: "1" },
    )
    expect(code).to.equal(2)
    const payload = JSON.parse(stdout)
    expect(payload.error).to.equal("include-depth-exceeded")
    expect(payload.max).to.equal(1)
  })

  it("default max depth (32) trips on a 34-deep chain", async () => {
    // Generate a chain of 34 dockerfiles in a tmp dir. With the default depth
    // of 32, level 33 (nestingLevel=33) trips the guard. We don't pass
    // --max-include-depth so we exercise the unset-default codepath.
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dfx-deep-"))
    try {
      for (let i = 1; i <= 34; i++) {
        const next = i < 34 ? `INCLUDE ./d-${i + 1}.dockerfile\n` : ""
        await fs.writeFile(
          path.join(tmp, `d-${i}.dockerfile`),
          `${next}FROM alpine:3\n`,
        )
      }
      const { stdout, code } = await runCli(`-c ${tmp} -f d-1.dockerfile`)
      expect(code).to.equal(2)
      const payload = JSON.parse(stdout)
      expect(payload.error).to.equal("include-depth-exceeded")
      expect(payload.max).to.equal(32)
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
