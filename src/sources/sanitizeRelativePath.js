const { PATH_TRAVERSAL } = require("../errors/codes")

/**
 * Lexical guard for paths inside a remote source (git repo, OCI artifact).
 * Strips leading slashes and rejects any `..` segment with a typed PATH_TRAVERSAL
 * error. Used at constructor time, where the cache directory isn't known yet —
 * the runtime check via assertContained() handles symlink/canonical escapes.
 */
module.exports = function sanitizeRelativePath(filePath, displayRef) {
  const cleaned = filePath.replace(/^\/+/, "")
  const segments = cleaned.split(/[/\\]/)
  if (segments.some((s) => s === "..")) {
    const err = new Error(
      `path-traversal: ${displayRef} escapes its source directory`,
    )
    err.code = PATH_TRAVERSAL
    err.ref = displayRef
    throw err
  }
  return cleaned
}
