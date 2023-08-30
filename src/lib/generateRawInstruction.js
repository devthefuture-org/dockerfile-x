const isJsonArrayOfString = require("../utils/isJsonArrayOfString")

module.exports = function generateRawInstruction(instruction) {
  // only excpected to be used for FROM, COPY and ADD instructions
  if (typeof instruction.args === "string") {
    return `${instruction.name} ${instruction.args}`
  } else if (isJsonArrayOfString(instruction.raw)) {
    return `${instruction.name} ${JSON.stringify(instruction.args)}`
  } else {
    return `${instruction.name} ${instruction.args.join(" ")}`
  }
}
