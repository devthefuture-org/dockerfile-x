const path = require("path")
const os = require("os")
const fs = require("fs/promises")

const { Command } = require("commander")

const rooLoadDockerfile = require("../core/rootLoadDockerfile")
const getDataFromStdin = require("../utils/getDataFromStdin")

const pkg = require(`../../package.json`)

module.exports = function createProgram() {
  const program = new Command(pkg.name)

  program.description(pkg.description)
  program.version(pkg.version)

  return program
    .option("-c, --context <path>", "Path to the build context", process.cwd())
    .option(
      "-f, --file <filename>",
      "Name of the Dockerfile",
      process.stdin.isTTY === undefined ? "-" : "Dockerfile",
    )
    .option("-o, --output <outputFile>", "Path to output file")
    .action(async (cmd) => {
      let { file } = cmd
      if (file === "-") {
        const stdin = await getDataFromStdin()
        const tempFilePath = path.join(
          process.env.DOCKERFILEX_TMPDIR || os.tmpdir(),
          "DockerfileX_" + Date.now(),
        )
        await fs.writeFile(tempFilePath, stdin)
        file = tempFilePath
      }

      const { context: dockerContext, output } = cmd
      const absoluteDockerfilePath = path.isAbsolute(file)
        ? file
        : path.join(dockerContext, file)

      const processedDockerfile = await rooLoadDockerfile(
        absoluteDockerfilePath,
        {
          dockerContext,
        },
      )

      if (output) {
        await fs.writeFile(output, processedDockerfile, "utf8")
      } else {
        process.stdout.write(processedDockerfile)
      }
    })
}
