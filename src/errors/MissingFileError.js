const { MISSING_FILE } = require("./codes")

class MissingFileError extends Error {
  constructor(filename, cause) {
    super(`missing-file: ${filename}`)
    this.code = MISSING_FILE
    this.filename = filename
    if (cause) this.cause = cause
  }
}

module.exports = MissingFileError
