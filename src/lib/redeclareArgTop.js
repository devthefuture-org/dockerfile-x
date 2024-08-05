const parseDockerfile = require("../lib/parseDockerfile")
const parseDockerfileXStartComment = require("../lib/parseDockerfileXStartComment")

module.exports = function redeclareArgTop(dockerContent) {
  const instructions = parseDockerfile(dockerContent)

  const allArgs = new Set()
  let inGlobalTop = true
  let inLocalTop = false
  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i]
    switch (instruction.name) {
      case "FROM": {
        inGlobalTop = false
        inLocalTop = false
        break
      }
      case "COMMENT": {
        if (instruction.raw.startsWith("# DOCKERFILE-X:START")) {
          const { includeType } = parseDockerfileXStartComment(instruction.raw)
          if (includeType === "from" || includeType === "fromParam") {
            inLocalTop = true
          }
        }
        break
      }
      case "ARG": {
        if (inGlobalTop) {
          break
        }
        if (inLocalTop) {
          allArgs.add("ARG " + instruction.args[0])
        }
        break
      }
    }
  }

  return [...allArgs, dockerContent].join("\n")
}
