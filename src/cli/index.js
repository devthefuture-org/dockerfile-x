const createProgram = require("./program")

module.exports = async function cli(args = process.argv) {
  const program = createProgram()
  return program.parseAsync(args)
}
