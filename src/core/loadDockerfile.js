const parseDockerfile = require("../lib/parseDockerfile")
const IncludeCycleError = require("../errors/IncludeCycleError")
const IncludeDepthExceededError = require("../errors/IncludeDepthExceededError")
const { DEFAULT_MAX_INCLUDE_DEPTH } = require("./limits")

const postProcessDockerfile = require("./postProcessDockerfile")

module.exports = loadDockerfile // placed here to fix circular dependencies

const instructionFactory = require("../instruction") // placed here to fix circular dependencies

// `isRootInclude` is set by the INCLUDE handler when an INCLUDE appears at
// nesting level 0; FROM/COPY-from handlers deliberately do NOT set it. The
// flag is consumed by postProcessDockerfile to decide:
//   - whether to scope stage names per-file (off for the inlined INCLUDE body
//     so an INCLUDE inlines verbatim, on for FROM-included content so its
//     stages live in their own namespace), and
//   - whether to emit a trailing alias on the last FROM (off for INCLUDEd
//     content because the parent's FROM rewrite owns the alias).
// The asymmetry is what makes INCLUDE inline-paste while FROM/COPY-from
// pull a *referenced* stage.
async function loadDockerfile(source, fileContext = {}) {
  const {
    parentStageTarget = null,
    parentStageAlias = null,
    nestingLevel = 0,
    dockerContext,
    scope = [],
    includeChain = [],
    maxIncludeDepth = DEFAULT_MAX_INCLUDE_DEPTH,
    isRootInclude,
  } = fileContext

  if (nestingLevel > maxIncludeDepth) {
    throw new IncludeDepthExceededError(
      nestingLevel,
      maxIncludeDepth,
      includeChain,
    )
  }

  // Resolve remote identity (oid/digest) eagerly so the cycle key reflects
  // the resolved commit/digest even for top-level references — a moving
  // `main` or `:latest` tag still pins to a stable id for cycle detection.
  await source.resolve()

  const sourceKey = source.key()
  if (includeChain.includes(sourceKey)) {
    throw new IncludeCycleError(sourceKey, includeChain)
  }

  const content = await source.read()

  const relativeFilePath = source.displayPath(dockerContext)
  scope.push(relativeFilePath)
  const nextIncludeChain = [...includeChain, sourceKey]

  const isRootFile = nestingLevel === 0
  const filePath = source.fsPath()

  const processingContext = {
    ...fileContext,
    scope,
    includeChain: nextIncludeChain,
    parentSource: source,
    filePath,
    relativeFilePath,
    isRootFile,
    maxIncludeDepth,
  }

  const instructionProcessors = instructionFactory(processingContext)

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
