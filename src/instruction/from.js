const generateFilePathSlug = require("../utils/generateFilePathSlug")
const asMatchRegex = require("../regex/asMatch")
const includeFromRegex = require("../regex/includeFrom")
const loadDockerfile = require("../core/loadDockerfile")
const generateIncluded = require("../core/generateIncluded")
const detectScheme = require("../sources/detectScheme")
const resolveSource = require("../sources/resolveSource")

const { SCHEMES } = detectScheme

module.exports = ({
  nestingLevel = 0,
  dockerContext,
  parentSource,
  relativeFilePath,
  scope,
  includeChain,
  maxIncludeDepth,
}) =>
  async function processFrom(instruction) {
    const argsStr = instruction.args
    const firstToken = argsStr.split(/ AS /i)[0].trim()
    const scheme = detectScheme(firstToken)
    const isRemote = scheme !== SCHEMES.LOCAL
    const isLocalInclude = !isRemote && includeFromRegex.test(firstToken)

    if (!isRemote && !isLocalInclude) {
      return [instruction.raw]
    }

    // Remote refs in this version do not support `#stage` targeting; the whole
    // pre-AS token is the ref. Local relative paths keep the legacy `#stage` syntax.
    let includeRef
    let targetStage = null
    if (isRemote) {
      includeRef = firstToken
    } else {
      const parts = firstToken.split("#")
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

    const asMatch = argsStr.match(asMatchRegex)
    const stageName = asMatch?.[1] || "final-stage"
    return [
      generateIncluded({
        includePathRelative: includeRef,
        relativeFilePath,
        includedContent,
        includingInstruction: "from",
      }),
      `FROM ${stageAlias} AS ${stageName}`,
    ]
  }
