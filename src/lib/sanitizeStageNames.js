const sanitizeStageName = require("../utils/sanitizeStageName")

const generateRawInstruction = require("../lib/generateRawInstruction")

const parseDockerfile = require("./parseDockerfile")

module.exports = function sanitizeStageNames(content) {
  const instructions = parseDockerfile(content)
  let result = ""

  // Map to hold original stage alias to sanitized version
  const stageAliasMap = new Map()

  instructions.forEach((instruction) => {
    if (instruction.name === "FROM") {
      const parts = instruction.args.split(/\s+AS\s+/i)
      let imageName = parts[0]

      // If the imageName matches a previously declared stage alias, sanitize it
      if (stageAliasMap.has(imageName)) {
        imageName = stageAliasMap.get(imageName)
      }

      if (parts.length === 2) {
        const originalAlias = parts[1]
        const sanitizedAlias = sanitizeStageName(originalAlias)
        stageAliasMap.set(originalAlias, sanitizedAlias)

        result += `FROM ${imageName} AS ${sanitizedAlias}\n`
      } else {
        result += `FROM ${imageName}\n`
      }
    } else if (instruction.name === "COPY" || instruction.name === "ADD") {
      const { args } = instruction
      for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith("--from=")) {
          const originalFromValue = args[i].split("=")[1]
          if (stageAliasMap.has(originalFromValue)) {
            // Replace the stage name with the sanitized version from the map
            args[i] = `--from=${stageAliasMap.get(originalFromValue)}`
          }
        }
      }
      instruction.raw = generateRawInstruction(instruction)
      result += instruction.raw + "\n"
    } else {
      result += instruction.raw + "\n"
    }
  })

  return result
}
