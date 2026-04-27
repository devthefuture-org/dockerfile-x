const path = require("path")

const loadDockerfile = require("./loadDockerfile")
const redeclareArgTop = require("../lib/redeclareArgTop")
const LocalSource = require("../sources/LocalSource")
const resolveSource = require("../sources/resolveSource")
const detectScheme = require("../sources/detectScheme")

module.exports = async function rootLoadDockerfile(
  filePathOrSource,
  fileContext = {},
) {
  const source =
    filePathOrSource && typeof filePathOrSource.read === "function"
      ? filePathOrSource
      : detectScheme(filePathOrSource) !== detectScheme.SCHEMES.LOCAL
        ? resolveSource(filePathOrSource, {
            dockerContext: fileContext.dockerContext,
          })
        : new LocalSource({
            filePath: filePathOrSource,
            dockerContext: fileContext.dockerContext,
            // Root local Dockerfile children resolve against dockerContext
            // (BuildKit limitation, see README).
            relativeBase: fileContext.dockerContext
              ? path.resolve(fileContext.dockerContext)
              : undefined,
          })

  let result = await loadDockerfile(source, fileContext)
  result = redeclareArgTop(result)
  return result
}
