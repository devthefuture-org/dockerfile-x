const path = require("path")
const fs = require("fs/promises")

const Source = require("./Source")
const tryWithExtension = require("./tryWithExtension")
const MissingFileError = require("../errors/MissingFileError")

const DEFAULT_DOCKERFILE_EXTENSION = ".dockerfile"

class LocalSource extends Source {
  constructor({
    filePath,
    dockerContext,
    defaultExtension,
    relativeBase,
  }) {
    super()
    this._absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(filePath)
    this._dockerContext = dockerContext
    this._defaultExtension =
      defaultExtension !== undefined
        ? defaultExtension
        : DEFAULT_DOCKERFILE_EXTENSION
    // Where children resolve relative paths from. Defaults to this file's
    // dirname; the root local Dockerfile uses dockerContext to honor the
    // BuildKit limitation documented in the README.
    this._relativeBase = relativeBase || path.dirname(this._absPath)
    // Set by read() once the on-disk path is known (may include an
    // auto-appended default extension). Consumed by fsPath()/displayPath().
    this._resolvedAbsPath = null
  }

  async read() {
    let resolvedCandidate = null
    const tried = await tryWithExtension(
      this._absPath,
      this._defaultExtension,
      async (candidate) => {
        try {
          const content = await fs.readFile(candidate, "utf-8")
          resolvedCandidate = candidate
          return content
        } catch (err) {
          if (err.code === "ENOENT") return null
          throw err
        }
      },
    )
    if (tried !== null && tried !== undefined) {
      this._resolvedAbsPath = resolvedCandidate
      return tried
    }

    throw new MissingFileError(this.displayPath(this._dockerContext))
  }

  joinRelative(relPath) {
    return new LocalSource({
      filePath: path.join(this._relativeBase, relPath),
      dockerContext: this._dockerContext,
      defaultExtension: this._defaultExtension,
    })
  }

  withDefaultExtension(defaultExtension) {
    return new LocalSource({
      filePath: this._absPath,
      dockerContext: this._dockerContext,
      defaultExtension,
      relativeBase: this._relativeBase,
    })
  }

  key() {
    return `local:${this._absPath}`
  }

  displayPath(dockerContext) {
    const ctx = dockerContext || this._dockerContext
    const target = this._resolvedAbsPath || this._absPath
    return ctx ? path.relative(ctx, target) : target
  }

  fsPath() {
    return this._resolvedAbsPath || this._absPath
  }

  stageAliasBase(dockerContext) {
    return path.relative(
      dockerContext || this._dockerContext,
      this._resolvedAbsPath || this._absPath,
    )
  }
}

module.exports = LocalSource
module.exports.DEFAULT_DOCKERFILE_EXTENSION = DEFAULT_DOCKERFILE_EXTENSION
