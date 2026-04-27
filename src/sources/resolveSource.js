const detectScheme = require("./detectScheme")
const LocalSource = require("./LocalSource")

const { SCHEMES } = detectScheme

// Match any URI-like prefix `<scheme>:` (with optional `//`). Used to reject
// unrecognized schemes before they reach `parentSource.joinRelative()`, where
// e.g. `new URL("file:///etc/passwd", parentUrl)` would silently scheme-jump.
const UNKNOWN_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

/**
 * Resolve an include reference into a Source object.
 *
 * @param {string} reference  raw reference as written in the Dockerfile
 * @param {object} ctx
 * @param {Source} [ctx.parentSource]   parent source (for relative refs in its domain)
 * @param {string} [ctx.dockerContext]  build context (used for the root local Dockerfile)
 * @param {string} [ctx.defaultExtension]  ".dockerfile" or ".env"
 * @returns {Source}
 */
function resolveSource(reference, ctx = {}) {
  const { parentSource, dockerContext, defaultExtension } = ctx
  const scheme = detectScheme(reference)

  if (scheme === SCHEMES.HTTP) {
    const HttpSource = require("./HttpSource")
    return new HttpSource({ url: reference, defaultExtension })
  }
  if (scheme === SCHEMES.GIT) {
    const GitSource = require("./GitSource")
    return GitSource.parse(reference, { defaultExtension })
  }
  if (scheme === SCHEMES.OCI) {
    const OciSource = require("./OciSource")
    return OciSource.parse(reference, { defaultExtension })
  }

  // Local: anything else must be a scheme-less relative or absolute path.
  // Reject e.g. `file:///etc/passwd`, `javascript:...`, `ftp://...` so they
  // can't escape via `parentSource.joinRelative()` (which uses `new URL(...)`
  // for HttpSource and would let an absolute URL replace the base).
  if (typeof reference === "string" && UNKNOWN_SCHEME_RE.test(reference)) {
    throw new Error(
      `Unsupported include scheme: ${reference} (expected git+, oci://, https?://, or a relative/absolute path)`,
    )
  }

  if (parentSource) {
    const child = parentSource.joinRelative(reference)
    return defaultExtension !== undefined && child.withDefaultExtension
      ? child.withDefaultExtension(defaultExtension)
      : child
  }
  return new LocalSource({
    filePath: reference,
    dockerContext,
    defaultExtension,
  })
}

module.exports = resolveSource
