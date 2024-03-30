const parseDockerfile = require("../lib/parseDockerfile")

module.exports = function redeclareArgTop(dockerContent) {
  const instructions = parseDockerfile(dockerContent)

  const allArgs = new Set()
  let inTop
  for (const instruction of instructions) {
    if (instruction.name === "FROM") {
      inTop = false
      continue
    }
    if (!inTop && instruction.name === "ARG") {
      allArgs.add("ARG " + instruction.args[0].split("=")[0])
    }
  }

  return [...allArgs, dockerContent].join("\n")
}
