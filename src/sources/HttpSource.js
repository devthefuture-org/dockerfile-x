const path = require("path")

const Source = require("./Source")
const downloadWithCache = require("../lib/downloadWithCache")
const { REMOTE_FETCH_FAILED } = require("../errors/codes")
const RemoteFileNotFoundError = require("../errors/RemoteFileNotFoundError")

class HttpSource extends Source {
  constructor({ url, defaultExtension = ".dockerfile" }) {
    super()
    this._defaultExtension = defaultExtension
    this._originalUrl = url
    // Eagerly append default extension when the pathname lacks any — saves a
    // guaranteed 404 round-trip for the common `INCLUDE https://x/y/z` case.
    // Mutate `pathname` (not raw URL) so `?query` and `#fragment` survive.
    if (defaultExtension) {
      const parsed = new URL(url)
      if (!path.extname(parsed.pathname)) {
        parsed.pathname += defaultExtension
        url = parsed.toString()
      }
    }
    this._url = url
  }

  async read() {
    try {
      return await downloadWithCache(this._url)
    } catch (err) {
      // 404 is an authoritative "not found" — surface it as the typed
      // RemoteFileNotFoundError so callers can branch on the same code that
      // GitSource and OciSource emit for the equivalent miss.
      if (err.response?.status === 404) {
        throw new RemoteFileNotFoundError(this._url, err)
      }
      const original = this._originalUrl
      const suffix = original && original !== this._url ? ` (from ${original})` : ""
      const wrapped = new Error(
        `Failed to fetch ${this._url}${suffix}: ${err.message}`,
      )
      wrapped.code = REMOTE_FETCH_FAILED
      wrapped.url = this._url
      wrapped.originalUrl = original
      wrapped.cause = err
      throw wrapped
    }
  }

  joinRelative(relPath) {
    // Defense-in-depth: resolveSource already rejects scheme-bearing relative
    // paths, but `new URL(absUrl, base)` would silently drop the base if the
    // guard ever regressed. Reject here too.
    if (/^[a-z][a-z0-9+.-]*:/i.test(relPath)) {
      throw new Error(
        `HttpSource.joinRelative rejected scheme-bearing path: ${relPath}`,
      )
    }
    return new HttpSource({
      url: new URL(relPath, this._url).toString(),
      defaultExtension: this._defaultExtension,
    })
  }

  key() {
    return this._url
  }

  displayPath() {
    return this._url
  }

  stageAliasBase() {
    return this._url
  }
}

module.exports = HttpSource
