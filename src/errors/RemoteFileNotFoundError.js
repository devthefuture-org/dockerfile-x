const { REMOTE_FILE_NOT_FOUND } = require("./codes")

/**
 * A path was not found inside a remote source (git repo, OCI artifact, HTTP
 * 404). Distinct from MissingFileError so the Go BuildKit frontend doesn't
 * retry the LLB-context lookup, which only makes sense for local files.
 *
 * Carries `ref` (not `filename`) — the value is a remote reference, not a
 * filesystem path, and the Go frontend's missing-file retry hinges on the
 * `filename` key being present only for local misses.
 */
class RemoteFileNotFoundError extends Error {
  constructor(ref, cause) {
    super(`remote-file-not-found: ${ref}`)
    this.code = REMOTE_FILE_NOT_FOUND
    this.ref = ref
    if (cause) this.cause = cause
  }
}

module.exports = RemoteFileNotFoundError
