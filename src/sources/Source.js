// Abstract include source. Implementations: LocalSource, HttpSource, GitSource,
// OciSource. `joinRelative` is always called with a non-scheme relative path —
// scheme detection lives in resolveSource.
class Source {
  // eslint-disable-next-line class-methods-use-this
  async read() {
    throw new Error("Source.read() not implemented")
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  joinRelative(_relPath) {
    throw new Error("Source.joinRelative() not implemented")
  }

  // eslint-disable-next-line class-methods-use-this
  key() {
    throw new Error("Source.key() not implemented")
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  displayPath(_dockerContext) {
    throw new Error("Source.displayPath() not implemented")
  }

  // Stable seed for stage-name slug (md5'd downstream).
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  stageAliasBase(_dockerContext) {
    throw new Error("Source.stageAliasBase() not implemented")
  }

  // Real fs path for sources backed by a local file; null otherwise.
  // Consumed by postProcessDockerfile (error messages) and stage scoping.
  // eslint-disable-next-line class-methods-use-this
  fsPath() {
    return null
  }

  // Eagerly resolve the remote identity (oid/digest) so that key() returns a
  // stable value before read(). Local sources are no-ops. Override in remote
  // sources that need an extra round-trip.
  // eslint-disable-next-line class-methods-use-this
  async resolve() {
    /* no-op */
  }
}

module.exports = Source
