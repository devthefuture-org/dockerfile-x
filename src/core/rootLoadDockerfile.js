const loadDockerfile = require("./loadDockerfile")
const redeclareArgTop = require("../lib/redeclareArgTop")

module.exports = async function rootLoadDockerfile(filePath, fileContext) {
  let result = await loadDockerfile(filePath, fileContext)
  result = redeclareArgTop(result)
  return result
}
