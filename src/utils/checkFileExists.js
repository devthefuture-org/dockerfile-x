const fs = require("fs")
module.exports = function checkFileExists(file) {
  return fs.promises
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false)
}
