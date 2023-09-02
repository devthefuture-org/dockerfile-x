const generateFilePathSlug = require("../utils/generateFilePathSlug")
const generateRawInstruction = require("../lib/generateRawInstruction")
const includeFromRegex = require("../regex/includeFrom")
const asMatchRegex = require("../regex/asMatch")

module.exports = function scopeStages(instructions, { relativeFilePath }) {
  const stageNamePrefix = generateFilePathSlug(relativeFilePath)

  let stageNames = []

  // Identify all stages
  for (let instruction of instructions) {
    if (instruction.name === "FROM") {
      const asMatch = instruction.args.match(asMatchRegex)
      if (asMatch) {
        stageNames.push(asMatch[1])
      } else {
        const isIncludeFrom = includeFromRegex.test(instruction.args)
        if (isIncludeFrom) {
          continue
        }
        const generatedName = `final-stage`
        stageNames.push(generatedName)
        instruction.args += ` AS ${generatedName}`
        instruction.raw = generateRawInstruction(instruction)
      }
    }
  }

  // Reprefix the stage names in the instructions array
  for (let stageName of stageNames) {
    for (let instruction of instructions) {
      // Update AS instruction
      if (
        instruction.name === "FROM" &&
        instruction.args.endsWith(`AS ${stageName}`)
      ) {
        instruction.args = instruction.args.replace(
          `AS ${stageName}`,
          `AS ${stageNamePrefix}--${stageName}`,
        )
        instruction.raw = generateRawInstruction(instruction)
      }

      // Update references in FROM instruction
      if (
        instruction.name === "FROM" &&
        instruction.args.startsWith(stageName)
      ) {
        const asMatch = instruction.args.match(asMatchRegex)
        instruction.args = `${stageNamePrefix}--${stageName} AS ${asMatch[1]}`
        instruction.raw = generateRawInstruction(instruction)
      }

      // Update --from= arguments
      if (instruction.name === "COPY" || instruction.name === "ADD") {
        const fromArg = `--from=${stageName}`
        const fromArgIndex = instruction.args.indexOf(fromArg)
        if (fromArgIndex === -1) {
          continue
        }
        instruction.args[
          fromArgIndex
        ] = `--from=${stageNamePrefix}--${stageName}`
        instruction.raw = generateRawInstruction(instruction)
      }
    }
  }
}
