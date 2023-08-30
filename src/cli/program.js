const fs = require("fs/promises")
const path = require("path")

const { Command } = require("commander")

const loadDockerfile = require("../core/loadDockerfile")

const pkg = require(`../../package.json`)

module.exports = function createProgram() {
  const program = new Command(pkg.name)

  program.description(pkg.description)
  program.version(pkg.version)

  return program
    .option(
      "-c, --context <path>",
      "Path to the build context",
      process.env.BUILDKIT_CONTEXT_PATH || process.cwd(),
    )
    .option(
      "-f, --file <filename>",
      "Name of the Dockerfile",
      process.env.BUILDKIT_FRONTEND_OPT_FILENAME || "Dockerfile",
    )
    .option("-o, --output <outputFile>", "Path to output file")
    .action(async (cmd) => {
      const { context: dockerContext, file, output } = cmd
      const absoluteDockerfilePath = file.startsWith("/")
        ? file
        : path.join(dockerContext, file)
      const rootDockerfileDir = path.dirname(absoluteDockerfilePath)
      const processedDockerfile = await loadDockerfile(absoluteDockerfilePath, {
        dockerContext,
        rootDockerfileDir,
      })

      if (output) {
        await fs.writeFile(output, processedDockerfile, "utf8")
      } else {
        process.stdout.write(processedDockerfile)
      }
    })
}
