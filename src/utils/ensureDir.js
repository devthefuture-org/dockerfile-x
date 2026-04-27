const fs = require("fs/promises")

module.exports = function ensureDir(dir) {
  return fs.mkdir(dir, { recursive: true })
}
