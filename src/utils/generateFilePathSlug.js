const path = require("path")
const crypto = require("crypto")

const stageNameFilterRegex = require("../regex/stageNameFilter")

module.exports = function generateFilePathSlug(filePath) {
  const filename = path
    .basename(filePath, path.extname(filePath))
    .toLowerCase()
    .replace(stageNameFilterRegex, "-")

  const hash = crypto
    .createHash("md5")
    .update(filePath)
    .digest("hex")
    .substring(0, 6)
  return `${filename.slice(0, 6)}${hash}`
}
