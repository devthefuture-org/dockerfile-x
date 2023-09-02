const path = require("path")

const generateFilePathSlug = require("../utils/generateFilePathSlug")
const generateRawInstruction = require("../lib/generateRawInstruction")

const loadDockerfile = require("../core/loadDockerfile")
const generateIncluded = require("../core/generateIncluded")

module.exports = ({
  nestingLevel,
  dockerContext,
  filePath,
  relativeFilePath,
  scope,
}) =>
  async function processFromParam(instruction, lines) {
    const fromMatch = instruction.raw.match(/--from=(\.\/[^ ]+|\/[^ ]+)/)
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

      lines.unshift(
        generateIncluded({
          includePathRelative,
          relativeFilePath,
          includedContent,
        }),
      )

      instruction.args = instruction.args.map((arg) => {
        if (arg.startsWith("--from=")) {
          arg = `--from=${stageAlias}`
        }
        return arg
      })
      instruction.raw = generateRawInstruction(instruction)
    }

    lines.push(instruction.raw)
  }
