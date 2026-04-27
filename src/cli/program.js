const path = require("path")
const os = require("os")
const fs = require("fs/promises")

const { Command } = require("commander")

const rootLoadDockerfile = require("../core/rootLoadDockerfile")
const getDataFromStdin = require("../utils/getDataFromStdin")
const {
  DEFAULT_MAX_INCLUDE_DEPTH,
  getMaxIncludeDepthFromEnv,
} = require("../core/limits")
const emitJsonErrorAndExit = require("../errors/emitJsonError")
const {
  INCLUDE_CYCLE,
  INCLUDE_DEPTH_EXCEEDED,
  MISSING_FILE,
  PATH_TRAVERSAL,
  REMOTE_FETCH_FAILED,
  REMOTE_FILE_NOT_FOUND,
} = require("../errors/codes")

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
    .option(
      "--max-include-depth <n>",
      "Maximum nested include depth before erroring out (also via env DOCKERFILEX_MAX_INCLUDE_DEPTH)",
      (v) => {
        const n = Number.parseInt(v, 10)
        if (Number.isNaN(n) || n < 1) {
          throw new Error(`--max-include-depth must be a positive integer (got "${v}")`)
        }
        return n
      },
    )
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
        // Best-effort cleanup on normal exit. Synchronous because async
        // handlers don't run during process exit. Errors swallowed: the
        // temp file is in tmpdir, OS cleanup will reap it eventually.
        process.once("exit", () => {
          try {
            require("fs").unlinkSync(tempFilePath)
          } catch {
            /* best-effort */
          }
        })
      }

      const { context: dockerContext, output } = cmd
      const absoluteDockerfilePath = path.isAbsolute(file)
        ? file
        : path.join(dockerContext, file)

      let maxIncludeDepth
      try {
        maxIncludeDepth =
          cmd.maxIncludeDepth ??
          getMaxIncludeDepthFromEnv() ??
          DEFAULT_MAX_INCLUDE_DEPTH
      } catch (err) {
        // Bad env var input — surface the same way commander surfaces a bad
        // CLI flag value: stderr + non-zero exit. Exit code 2 is reserved
        // for the Go frontend's "file to load" retry contract; config errors
        // must NOT use it.
        process.stderr.write(`${err.message}\n`)
        process.exitCode = 1
        return
      }

      let processedDockerfile
      try {
        processedDockerfile = await rootLoadDockerfile(
          absoluteDockerfilePath,
          {
            dockerContext,
            maxIncludeDepth,
          },
        )
      } catch (err) {
        if (!err || !err.code) throw err
        switch (err.code) {
          case INCLUDE_CYCLE:
          case INCLUDE_DEPTH_EXCEEDED:
            emitJsonErrorAndExit({
              error: err.code,
              ...(err.depth !== undefined ? { depth: err.depth } : {}),
              ...(err.max !== undefined ? { max: err.max } : {}),
              chain: err.chain,
            })
            break
          case MISSING_FILE:
            emitJsonErrorAndExit({
              error: err.code,
              filename: err.filename,
            })
            break
          case REMOTE_FILE_NOT_FOUND:
            // `ref` instead of `filename`: keeps the Go frontend's missing-file
            // LLB retry strictly limited to local-file errors.
            emitJsonErrorAndExit({
              error: err.code,
              ref: err.ref,
            })
            break
          case PATH_TRAVERSAL:
            emitJsonErrorAndExit({ error: err.code, ref: err.ref })
            break
          case REMOTE_FETCH_FAILED:
            emitJsonErrorAndExit({
              error: err.code,
              url: err.url,
              ...(err.originalUrl && err.originalUrl !== err.url
                ? { originalUrl: err.originalUrl }
                : {}),
              message: err.message,
            })
            break
          default:
            throw err
        }
        // emitJsonErrorAndExit schedules the exit asynchronously after stdout
        // flushes; bail out here so we don't try to write `undefined` below.
        return
      }

      if (output) {
        await fs.writeFile(output, processedDockerfile, "utf8")
      } else {
        process.stdout.write(processedDockerfile)
      }
    })
}
