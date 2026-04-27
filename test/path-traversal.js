const path = require("path")
const fs = require("fs/promises")
const os = require("os")
const { expect } = require("chai")

const GitSource = require("../src/sources/GitSource")
const OciSource = require("../src/sources/OciSource")
const HttpSource = require("../src/sources/HttpSource")
const resolveSource = require("../src/sources/resolveSource")
const { assertContainedReal } = require("../src/sources/assertContained")
const { PATH_TRAVERSAL } = require("../src/errors/codes")

describe("source key uniqueness across schemes", () => {
  // Cycle detection uses Array.includes(source.key()). If two different
  // sources for the "same logical resource" produced equal keys, an
  // inter-scheme include chain could be flagged as a cycle when it isn't —
  // and conversely a refactor that normalized away the scheme prefix would
  // silently weaken cycle detection. Pin the contract: scheme prefix is
  // part of the key.
  it("HttpSource, GitSource, OciSource produce distinct keys for the same path", () => {
    const http = new HttpSource({ url: "https://example.com/foo/bar.dockerfile" })
    const git = GitSource.parse(
      "git+https://example.com/foo.git#main:bar.dockerfile",
    )
    const oci = OciSource.parse("oci://example.com/foo:1.0#bar.dockerfile")
    const keys = [http.key(), git.key(), oci.key()]
    expect(new Set(keys).size).to.equal(3)
    expect(http.key()).to.match(/^https:\/\//)
    expect(git.key()).to.match(/^git\+/)
    expect(oci.key()).to.match(/^oci:\/\//)
  })
})

describe("OciSource digest-pinned references", () => {
  it("parses oci://reg/repo@sha256:... and skips the resolve round-trip", async () => {
    const ref =
      "oci://reg.example/foo/bar@sha256:" +
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" +
      "#snippets/base.dockerfile"
    const s = OciSource.parse(ref)
    expect(s.key()).to.equal(
      "oci://reg.example/foo/bar@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789#snippets/base.dockerfile",
    )
    // resolve() must be a no-op when a digest is already pinned — assert by
    // verifying nothing throws and key() is unchanged.
    await s.resolve()
    expect(s.key()).to.equal(
      "oci://reg.example/foo/bar@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789#snippets/base.dockerfile",
    )
  })

  it("parses oci://reg/repo:tag without confusing digest-form for tag", () => {
    const s = OciSource.parse("oci://reg.example/foo/bar:1.2.3#snippets/base.dockerfile")
    expect(s.key()).to.equal(
      "oci://reg.example/foo/bar:1.2.3#snippets/base.dockerfile",
    )
  })
})

describe("argv-injection guard (option-like args)", () => {
  it("GitSource rejects a repo that would be parsed as a flag", () => {
    expect(() =>
      GitSource.parse("git+--upload-pack=cmd#main:foo.dockerfile"),
    ).to.throw(/must not start with '-'/)
  })

  it("GitSource rejects a ref that would be parsed as a flag", () => {
    expect(() =>
      GitSource.parse(
        "git+https://example.com/x.git#--upload-pack=cmd:foo.dockerfile",
      ),
    ).to.throw(/must not start with '-'/)
  })

  it("OciSource rejects a registry that would be parsed as a flag", () => {
    expect(() =>
      OciSource.parse("oci://--evil/repo:tag#foo.dockerfile"),
    ).to.throw(/must not start with '-'/)
  })

  it("OciSource rejects a tag that would be parsed as a flag", () => {
    expect(() =>
      OciSource.parse("oci://reg.example/repo:--evil#foo.dockerfile"),
    ).to.throw(/must not start with '-'/)
  })
})

describe("path-traversal guard", () => {
  it("OciSource constructor rejects `..` segments", () => {
    expect(() =>
      OciSource.parse("oci://reg.example/repo:tag#../../etc/passwd"),
    ).to.throw(/path-traversal/)
  })

  it("OciSource constructor rejects nested `..` segments", () => {
    expect(() =>
      OciSource.parse("oci://reg.example/repo:tag#sub/../../etc/passwd"),
    ).to.throw(/path-traversal/)
  })

  it("GitSource constructor rejects `..` segments", () => {
    expect(() =>
      GitSource.parse("git+https://example.com/x.git#main:../../etc/passwd"),
    ).to.throw(/path-traversal/)
  })

  it("typed error carries PATH_TRAVERSAL code", () => {
    let err
    try {
      GitSource.parse("git+ssh://x/y.git#v1:../escape")
    } catch (e) {
      err = e
    }
    expect(err).to.exist
    expect(err.code).to.equal(PATH_TRAVERSAL)
    expect(err.ref).to.include("../escape")
  })

  it("OciSource.joinRelative rejects child paths that escape the artifact", () => {
    const parent = OciSource.parse("oci://reg.example/repo:tag#inc/app.dockerfile")
    expect(() => parent.joinRelative("../../../escape.dockerfile")).to.throw(
      /path-traversal/,
    )
  })

  it("GitSource.joinRelative rejects child paths that escape the repo", () => {
    const parent = GitSource.parse(
      "git+https://example.com/x.git#main:inc/app.dockerfile",
    )
    expect(() => parent.joinRelative("../../../escape.dockerfile")).to.throw(
      /path-traversal/,
    )
  })

  it("benign relative paths still work", () => {
    const parent = OciSource.parse("oci://reg.example/repo:tag#inc/app.dockerfile")
    const child = parent.joinRelative("./base.dockerfile")
    expect(child.displayPath()).to.include("inc/base.dockerfile")
  })

  describe("scheme-jump from a remote source", () => {
    it("rejects file:// reference resolved against an HTTP parent", () => {
      const parent = new HttpSource({ url: "https://a.example/x.dockerfile" })
      expect(() =>
        resolveSource("file:///etc/passwd", { parentSource: parent }),
      ).to.throw(/Unsupported include scheme/)
    })

    it("rejects an absolute http:// reference resolved against an HTTP parent", () => {
      const parent = new HttpSource({ url: "https://a.example/x.dockerfile" })
      // Even http(s):// is a scheme on the local-detection side: it should
      // re-enter resolveSource as an HTTP source, not be passed to joinRelative.
      const child = resolveSource("https://b.example/y.dockerfile", {
        parentSource: parent,
      })
      // The child must be a fresh HttpSource pointing at b.example, not a
      // joinRelative'd URL on a.example.
      expect(child.key()).to.equal("https://b.example/y.dockerfile")
    })

    it("rejects javascript: and other unknown schemes", () => {
      const parent = new HttpSource({ url: "https://a.example/x.dockerfile" })
      expect(() =>
        resolveSource("javascript:alert(1)", { parentSource: parent }),
      ).to.throw(/Unsupported include scheme/)
      expect(() =>
        resolveSource("ftp://a/b", { parentSource: parent }),
      ).to.throw(/Unsupported include scheme/)
    })
  })

  // assertContainedReal is the post-materialization symlink check used by
  // GitSource and OciSource. The git-symlink path is integration-tested in
  // remote-git.js; these tests pin the helper itself so the OCI path (which
  // calls the same helper but is harder to integration-test without a
  // hand-crafted OCI manifest carrying a symlink layer) is also locked down.
  describe("assertContainedReal", () => {
    let tmpRoot
    let outsideTarget

    before(async () => {
      tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dfx-real-"))
      outsideTarget = path.join(tmpRoot, "outside-target")
      await fs.writeFile(outsideTarget, "secret")
    })

    after(async () => {
      if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true })
    })

    it("accepts a regular file inside the parent dir", async () => {
      const parent = await fs.mkdtemp(path.join(tmpRoot, "parent-"))
      const child = path.join(parent, "ok.txt")
      await fs.writeFile(child, "hi")
      await assertContainedReal(parent, child, "ok.txt")
    })

    it("accepts a path that does not yet exist (lexical fallback)", async () => {
      const parent = await fs.mkdtemp(path.join(tmpRoot, "parent-"))
      // No file written — assertContainedReal falls back to lexical check.
      await assertContainedReal(parent, path.join(parent, "missing.txt"), "missing.txt")
    })

    it("rejects a symlink inside the parent that resolves outside", async () => {
      const parent = await fs.mkdtemp(path.join(tmpRoot, "parent-"))
      const sym = path.join(parent, "evil.txt")
      await fs.symlink(outsideTarget, sym)
      let err
      try {
        await assertContainedReal(parent, sym, "evil.txt")
      } catch (e) {
        err = e
      }
      expect(err).to.exist
      expect(err.code).to.equal(PATH_TRAVERSAL)
      expect(err.ref).to.equal("evil.txt")
    })

    it("rejects a nested symlink whose realpath escapes", async () => {
      const parent = await fs.mkdtemp(path.join(tmpRoot, "parent-"))
      const subdir = path.join(parent, "sub")
      await fs.mkdir(subdir)
      const sym = path.join(subdir, "evil.txt")
      await fs.symlink(outsideTarget, sym)
      let err
      try {
        await assertContainedReal(parent, sym, "sub/evil.txt")
      } catch (e) {
        err = e
      }
      expect(err).to.exist
      expect(err.code).to.equal(PATH_TRAVERSAL)
    })
  })
})
