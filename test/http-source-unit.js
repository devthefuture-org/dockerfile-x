const { expect } = require("chai")

const HttpSource = require("../src/sources/HttpSource")

describe("HttpSource", () => {
  describe("default-extension append", () => {
    it("appends .dockerfile when pathname has no extension", () => {
      const s = new HttpSource({ url: "https://a/b/c" })
      expect(s.key()).to.equal("https://a/b/c.dockerfile")
    })

    it("does not append when pathname already has an extension", () => {
      const s = new HttpSource({ url: "https://a/b/c.dockerfile" })
      expect(s.key()).to.equal("https://a/b/c.dockerfile")
    })

    it("preserves query strings while appending the extension", () => {
      const s = new HttpSource({ url: "https://a/b/c?token=abc&v=1" })
      expect(s.key()).to.equal("https://a/b/c.dockerfile?token=abc&v=1")
    })

    it("preserves fragments while appending the extension", () => {
      const s = new HttpSource({ url: "https://a/b/c#frag" })
      expect(s.key()).to.equal("https://a/b/c.dockerfile#frag")
    })
  })

  describe("joinRelative", () => {
    it("resolves a sibling path against the parent URL", () => {
      const parent = new HttpSource({ url: "https://a/b/c.dockerfile" })
      const child = parent.joinRelative("./d.dockerfile")
      expect(child.key()).to.equal("https://a/b/d.dockerfile")
    })

    it("appends extension to a relative path that lacks one, preserving query", () => {
      const parent = new HttpSource({
        url: "https://a/b/c.dockerfile?token=abc",
      })
      // Note: relative URLs don't carry the parent's query — but the constructor
      // must still treat the pathname correctly when appending the extension.
      const child = parent.joinRelative("./d")
      expect(child.key()).to.equal("https://a/b/d.dockerfile")
    })

    it("does not corrupt query when relative resolution preserves it", () => {
      const parent = new HttpSource({ url: "https://a/b/" })
      const child = parent.joinRelative("c?token=abc")
      // pathname is /b/c (no extension) -> append .dockerfile
      expect(child.key()).to.equal("https://a/b/c.dockerfile?token=abc")
    })
  })
})
