const { parse } = require("docker-file-parser")

const syntaxCommentRegex = require("../regex/syntaxComment")
const generateRawInstruction = require("../lib/generateRawInstruction")

module.exports = function parseDockerfile(content, options = {}) {
  const { removeSyntaxComments = true, ...parseOptions } = options
  const instructions = parse(content, {
    includeComments: true,
    ...parseOptions,
  })
  for (const instruction of instructions) {
    if (instruction.name === "COMMENT") {
      if (removeSyntaxComments && syntaxCommentRegex.test(instruction.args)) {
        instruction.raw = ""
      } else {
        instruction.raw = instruction.args
      }
    }
    if (instruction.name === "FROM") {
      instruction.args = instruction.args.replace(/(\s+)as(\s+)/gi, "$1AS$2")
      instruction.raw = generateRawInstruction(instruction)
    }
  }
  return instructions
}
