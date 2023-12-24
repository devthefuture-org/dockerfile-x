const { execSync } = require("child_process")
const { default: snap } = require("mocha-snap")

async function runTemplateTool(inputFile, context = ".") {
  let command
  if (process.env.DOCKERFILEX_TEST_BUILD) {
    command = `dist-bin/dockerfile-x -c ${context} -f ${inputFile}`
  } else {
    command = `node index.js -c ${context} -f ${inputFile}`
  }
  return execSync(command, { encoding: "utf-8" })
}

async function testFixture(name) {
  const result = await runTemplateTool(`${name}.dockerfile`, `test/fixtures`)
  await snap(result, { ext: ".dockerfile" })
}

module.exports = testFixture
