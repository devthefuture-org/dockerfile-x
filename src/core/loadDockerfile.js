const path = require("path")
const fs = require("fs/promises")

const parseDockerfile = require("../lib/parseDockerfile")
const checkFileExists = require("../utils/checkFileExists")

const postProcessDockerfile = require("./postProcessDockerfile")

module.exports = loadDockerfile // placed here to fix circular dependencies

const instructionFactory = require("../instruction") // placed here to fix circular dependencies

const defaultExtension = ".dockerfile"

async function loadDockerfile(filePath, fileContext = {}) {
  const {
    parentStageTarget = null,
    parentStageAlias = null,
    nestingLevel = 0,
    dockerContext,
    scope = [],
    isRootInclude,
  } = fileContext

  const relativeFilePath = path.relative(dockerContext, filePath)
  scope.push(relativeFilePath)

  if (!(await checkFileExists(filePath))) {
    let fileIsMissing = true
    if (path.extname(filePath) !== defaultExtension) {
      const filePathWithExt = `${filePath}${defaultExtension}`
      if (await checkFileExists(filePathWithExt)) {
        filePath = filePathWithExt
        fileIsMissing = false
      }
    }
    if (fileIsMissing) {
      process.stdout.write(
        JSON.stringify({
          error: "missing-file",
          filename: relativeFilePath,
        }),
      )
      process.exit(2)
    }
  }

  const isRootFile = nestingLevel === 0

  const processingContext = {
    ...fileContext,
    scope,
    filePath,
    relativeFilePath,
    isRootFile,
  }

  const instructionProcessors = instructionFactory(processingContext)

  const content = await fs.readFile(filePath, "utf-8")
  const instructions = parseDockerfile(content, {
    removeSyntaxComments: !isRootFile,
  })

  const lines = []
  for (const instruction of instructions) {
    const processor =
      instructionProcessors[instruction.name] || instructionProcessors._DEFAULT
    const instructionLines = await processor(instruction, lines)
    if (instructionLines) {
      lines.push(...instructionLines)
    }
  }
  let result = lines.join("\n")

  result = postProcessDockerfile(result, {
    stageTarget: parentStageTarget,
    stageAlias: parentStageAlias,
    filePath,
    isRootFile,
    isRootInclude,
    scope,
    relativeFilePath,
  })

  return result
}
