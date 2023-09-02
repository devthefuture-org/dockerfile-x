const path = require("path")

const generateFilePathSlug = require("../utils/generateFilePathSlug")
const asMatchRegex = require("../regex/asMatch")
const includeFromRegex = require("../regex/includeFrom")
const loadDockerfile = require("../core/loadDockerfile")
const generateIncluded = require("../core/generateIncluded")

module.exports = ({
  nestingLevel,
  dockerContext,
  filePath,
  relativeFilePath,
  scope,
}) =>
  async function processFrom(instruction) {
    const fromMatch = instruction.args.match(includeFromRegex)
    const result = []
    if (fromMatch) {
      const includePathParts = fromMatch[1].split("#")
      const includePath = path.join(path.dirname(filePath), includePathParts[0])
      const includePathRelative = includePathParts[0]
      const targetStage = includePathParts[1]
      const relativeIncludePath = path.relative(dockerContext, includePath)

      const stageAlias = generateFilePathSlug(relativeIncludePath)

      const includedContent = await loadDockerfile(includePath, {
        scope: [...scope],
        dockerContext,
        parentStageTarget: targetStage,
        parentStageAlias: stageAlias,
        nestingLevel: nestingLevel + 1,
      })

      result.push(
        generateIncluded({
          includePathRelative,
          relativeFilePath,
          includedContent,
        }),
      )
      const asMatch = instruction.args.match(asMatchRegex)
      const stageName = asMatch?.[1] || "final-stage"
      result.push(`FROM ${stageAlias} AS ${stageName}`)
    } else {
      result.push(instruction.raw)
    }
    return result
  }
