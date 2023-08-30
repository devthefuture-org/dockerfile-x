const { execSync } = require("child_process")
const { default: snap } = require("mocha-snap")

async function runTemplateTool(inputFile) {
  const command = `node index.js -f ${inputFile}`
  return execSync(command, { encoding: "utf-8" })
}

async function testFixture(name) {
  const result = await runTemplateTool(`test/fixtures/${name}.dockerfile`)
  await snap(result, { ext: ".dockerfile" })
}

module.exports = testFixture
