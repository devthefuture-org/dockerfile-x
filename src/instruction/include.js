const path = require("path")

const generateFilePathSlug = require("../utils/generateFilePathSlug")
const loadDockerfile = require("../core/loadDockerfile")
const generateIncluded = require("../core/generateIncluded")

module.exports = ({
  nestingLevel = 0,
  dockerContext,
  filePath,
  relativeFilePath,
  scope,
  isRootFile,
}) =>
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

    const includedContent = await loadDockerfile(includePath, {
      scope: [...scope],
      dockerContext,
      parentStageTarget: null,
      parentStageAlias: stageAlias,
      nestingLevel: nestingLevel + 1,
      isRootInclude: nestingLevel === 0,
    })

    const result = []

    result.push(
      generateIncluded({
        includePathRelative,
        relativeFilePath,
        includedContent,
      }),
    )

    return result
  }
