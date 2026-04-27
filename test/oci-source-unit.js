const { expect } = require("chai")

const OciSource = require("../src/sources/OciSource")
const { REMOTE_FETCH_FAILED } = require("../src/errors/codes")

const VALID_SHA256 =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
const VALID_SHA512 = VALID_SHA256 + VALID_SHA256

describe("OciSource", () => {
  describe("digest validation (parse path — forward-compat lenient)", () => {
    it("parses a valid sha256 digest", () => {
      const s = OciSource.parse(
        `oci://reg.example/foo/bar@sha256:${VALID_SHA256}#a.dockerfile`,
      )
      expect(s.key()).to.equal(
        `oci://reg.example/foo/bar@sha256:${VALID_SHA256}#a.dockerfile`,
      )
    })

    it("constructor accepts unknown algorithms (forward-compat)", () => {
      // Loose DIGEST_RE permits unknown algorithms at parse time so registries
      // publishing future algorithms keep working. Only the
      // registry-response path tightens length per known algorithm.
      const s = OciSource.parse(
        "oci://reg.example/foo/bar@blake3:abcdef#a.dockerfile",
      )
      expect(s.key()).to.include("@blake3:abcdef")
    })
  })

  // assertValidDigest is the strict check applied to digests sourced from
  // external bytes (registry response, OCI layout index.json) before they
  // become part of the cycle key. Lenient parse-side behavior is fine because
  // a malformed user-typed digest won't match any real registry artifact;
  // the threat model is a registry that returns garbage.
  describe("assertValidDigest (registry-side strict check)", () => {
    const { assertValidDigest } = OciSource

    it("accepts a full-length sha256 digest", () => {
      expect(() =>
        assertValidDigest(`sha256:${VALID_SHA256}`, "test"),
      ).to.not.throw()
    })

    it("accepts a full-length sha512 digest", () => {
      expect(() =>
        assertValidDigest(`sha512:${VALID_SHA512}`, "test"),
      ).to.not.throw()
    })

    it("rejects sha256 with under-length hex", () => {
      let err
      try {
        assertValidDigest("sha256:abcd", "test")
      } catch (e) {
        err = e
      }
      expect(err).to.exist
      expect(err.code).to.equal(REMOTE_FETCH_FAILED)
    })

    it("rejects sha256 with over-length hex", () => {
      // 65 hex chars
      let err
      try {
        assertValidDigest(`sha256:${VALID_SHA256}f`, "test")
      } catch (e) {
        err = e
      }
      expect(err).to.exist
      expect(err.code).to.equal(REMOTE_FETCH_FAILED)
    })

    it("accepts unknown algorithms (forward-compat)", () => {
      // Forward-compat: an algorithm we don't enumerate yet is allowed
      // through the loose check so a future-spec registry isn't broken.
      expect(() =>
        assertValidDigest("blake3:abcdef0123", "test"),
      ).to.not.throw()
    })

    it("rejects non-hex / malformed digests", () => {
      const cases = ["", "sha256:", "sha256:NOTHEX", "garbage", "sha256:zz"]
      for (const d of cases) {
        let err
        try {
          assertValidDigest(d, "test")
        } catch (e) {
          err = e
        }
        expect(err, `expected throw for "${d}"`).to.exist
        expect(err.code).to.equal(REMOTE_FETCH_FAILED)
      }
    })
  })

  describe("joinRelative digest preservation", () => {
    it("propagates the parent's pinned digest to the child", () => {
      const parent = OciSource.parse(
        `oci://reg.example/foo/bar@sha256:${VALID_SHA256}#inc/app.dockerfile`,
      )
      const child = parent.joinRelative("./base.dockerfile")
      expect(child.key()).to.equal(
        `oci://reg.example/foo/bar@sha256:${VALID_SHA256}#inc/base.dockerfile`,
      )
    })

    it("propagates the parent's tag when no digest is pinned yet", () => {
      const parent = OciSource.parse(
        "oci://reg.example/foo/bar:1.2.3#inc/app.dockerfile",
      )
      const child = parent.joinRelative("./base.dockerfile")
      expect(child.key()).to.equal(
        "oci://reg.example/foo/bar:1.2.3#inc/base.dockerfile",
      )
    })
  })
})
