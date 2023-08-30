const asMatchRegex = require("../regex/asMatch")

const generateFilePathSlug = require("../utils/generateFilePathSlug")

const parseDockerfile = require("../lib/parseDockerfile")
const sanitizeStageNames = require("../lib/sanitizeStageNames")
const deduplicateStages = require("../lib/deduplicateStages")

const scopeStages = require("./scopeStages")

module.exports = function postProcessDockerfile(
  content,
  { stageTarget, stageAlias, filePath, isRootFile, relativeFilePath, scope },
) {
  const instructions = parseDockerfile(content)

  if (!isRootFile) {
    scopeStages(instructions, { relativeFilePath })
  }

  let result = ""

  let fromCount = instructions.filter(
    (instruction) => instruction.name === "FROM",
  ).length

  let currentFromCount = 0

  let stageTargetFound
  let localStageTarget
  if (stageTarget) {
    localStageTarget = [
      generateFilePathSlug(scope[scope.length - 1]),
      stageTarget,
    ].join("--")
  }

  for (const instruction of instructions) {
    result += instruction.raw + "\n"
    if (instruction.name === "FROM") {
      currentFromCount++
      const asMatch = instruction.raw.match(asMatchRegex)
      const stageName = asMatch?.[1]
      const matchTargetStage =
        localStageTarget && localStageTarget === stageName
      if (matchTargetStage) {
        stageTargetFound = true
      }
      const isLastTarget = !localStageTarget && currentFromCount === fromCount
      if (stageAlias && (matchTargetStage || isLastTarget)) {
        result += `FROM ${stageName} AS ${stageAlias}` + "\n"
      }
    }
  }

  if (stageTarget && !stageTargetFound) {
    throw new Error(
      `Specified stage target "${stageTarget}" not found in "${filePath}"`,
    )
  }

  result = deduplicateStages(result)

  if (isRootFile) {
    result = sanitizeStageNames(result)
  }

  return result
}
