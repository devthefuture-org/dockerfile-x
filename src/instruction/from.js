const path = require("path")

const generateFilePathSlug = require("../utils/generateFilePathSlug")
const asMatchRegex = require("../regex/asMatch")
const includeFromRegex = require("../regex/includeFrom")
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
  async function processFrom(instruction) {
    const fromMatch = includeFromRegex.test(instruction.args)
    const result = []
    if (fromMatch) {
      const includePathParts = instruction.args.split(" AS ")[0].split("#")
      const includePath = path.join(
        isRootFile ? dockerContext : path.dirname(filePath),
        includePathParts[0],
      )
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
          includingInstruction: "from",
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
