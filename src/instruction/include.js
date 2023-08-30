const path = require("path")

const generateFilePathSlug = require("../utils/generateFilePathSlug")
const loadDockerfile = require("../core/loadDockerfile")
const generateIncluded = require("../core/generateIncluded")

module.exports = ({
  nestingLevel,
  rootDockerfileDir,
  filePath,
  relativeFilePath,
  scope,
}) =>
  async function processInclude(instruction) {
    const includePathRelative = Array.isArray(instruction.args)
      ? instruction.args[0]
      : instruction.args

    const includePath = path.join(path.dirname(filePath), includePathRelative)
    const relativeIncludePath = path.relative(rootDockerfileDir, includePath)

    const stageAlias = generateFilePathSlug(relativeIncludePath)

    const includedContent = await loadDockerfile(includePath, {
      scope: [...scope],
      rootDockerfileDir,
      parentStageTarget: null,
      parentStageAlias: stageAlias,
      nestingLevel: nestingLevel + 1,
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
