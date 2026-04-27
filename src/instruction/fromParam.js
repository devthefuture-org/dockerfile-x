const generateFilePathSlug = require("../utils/generateFilePathSlug")
const generateRawInstruction = require("../lib/generateRawInstruction")
const detectScheme = require("../sources/detectScheme")
const resolveSource = require("../sources/resolveSource")

const loadDockerfile = require("../core/loadDockerfile")
const generateIncluded = require("../core/generateIncluded")

const { SCHEMES } = detectScheme

// Accepts: remote schemes (http(s)://, git+, oci://), relative `./` and `../`,
// or absolute `/`. Matches the local-include rule advertised in the README.
const FROM_RE =
  /--from=((?:https?:\/\/|git\+|oci:\/\/)[^ ]+|\.{1,2}\/[^ ]+|\/[^ ]+)/i

module.exports = ({
  nestingLevel = 0,
  dockerContext,
  parentSource,
  relativeFilePath,
  scope,
  includeChain,
  maxIncludeDepth,
}) =>
  async function processFromParam(instruction, lines) {
    const fromMatch = instruction.raw.match(FROM_RE)
    if (!fromMatch) {
      lines.push(instruction.raw)
      return
    }

    const fromTarget = fromMatch[1]
    const isRemote = detectScheme(fromTarget) !== SCHEMES.LOCAL

    let includeRef
    let targetStage = null
    if (isRemote) {
      includeRef = fromTarget
    } else {
      const parts = fromTarget.split("#")
      includeRef = parts[0]
      targetStage = parts[1]
    }

    const childSource = resolveSource(includeRef, {
      parentSource,
      dockerContext,
      defaultExtension: ".dockerfile",
    })

    const stageAlias = generateFilePathSlug(
      childSource.stageAliasBase(dockerContext),
    )

    const includedContent = await loadDockerfile(childSource, {
      scope: [...scope],
      dockerContext,
      parentStageTarget: targetStage,
      parentStageAlias: stageAlias,
      nestingLevel: nestingLevel + 1,
      includeChain,
      maxIncludeDepth,
    })

    // Asymmetric vs sibling processors: we unshift the included body onto
    // `lines` so the included stage exists *before* the rewritten COPY/ADD,
    // then push the rewritten raw instruction last. Returning nothing here
    // keeps loadDockerfile from double-appending.
    lines.unshift(
      generateIncluded({
        includePathRelative: includeRef,
        relativeFilePath,
        includedContent,
        includingInstruction: "fromParam",
      }),
    )

    instruction.args = instruction.args.map((arg) =>
      arg.startsWith("--from=") ? `--from=${stageAlias}` : arg,
    )
    instruction.raw = generateRawInstruction(instruction)

    lines.push(instruction.raw)
    return
  }
