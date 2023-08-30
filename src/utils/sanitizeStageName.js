const crypto = require("crypto")

const stageNameFilterRegex = require("../regex/stageNameFilter")

module.exports = function sanitizeStageName(stagename) {
  stagename = stagename.toLowerCase().replace(stageNameFilterRegex, "_")
  if (stagename.length > 255) {
    const hash = crypto.createHash("sha256").update(stagename).digest("hex")
    stagename = stagename.substring(0, 244) + "-" + hash.substring(0, 10)
  }
  return stagename
}
