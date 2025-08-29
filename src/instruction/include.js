const path = require("path")

const generateFilePathSlug = require("../utils/generateFilePathSlug")
const generateIncluded = require("../core/generateIncluded")
const loadDockerfile = require("../core/loadDockerfile")
const loadEnvFileAndPrefix = require("../core/loadEnvFileAndPrefix")

module.exports = (
  {
    nestingLevel = 0,
    dockerContext,
    filePath,
    relativeFilePath,
    scope,
    isRootFile,
  },
  includeType = null,
) =>
  async function processInclude(instruction) {
    const includePathRelative = Array.isArray(instruction.args)
      ? instruction.args[0]
      : instruction.args

    const includePath = path.join(
      isRootFile ? dockerContext : path.dirname(filePath),
      includePathRelative,
    )
    const relativeIncludePath = path.relative(dockerContext, includePath)

    const stageAlias = generateFilePathSlug(relativeIncludePath)

    let includedContent
    switch (includeType) {
      case "ARG":
      case "ENV":
      case "LABEL":
        includedContent = await loadEnvFileAndPrefix(
          dockerContext,
          includePath,
          includeType + " ",
        )
        break

      default:
        includedContent = await loadDockerfile(includePath, {
          scope: [...scope],
          dockerContext,
          parentStageTarget: null,
          parentStageAlias: stageAlias,
          nestingLevel: nestingLevel + 1,
          isRootInclude: nestingLevel === 0,
        })
        break
    }

    const result = []

    result.push(
      generateIncluded({
        includePathRelative,
        relativeFilePath,
        includedContent,
        includingInstruction: "include",
      }),
    )

    return result
  }
