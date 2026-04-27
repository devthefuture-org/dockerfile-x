const generateFilePathSlug = require("../utils/generateFilePathSlug")
const generateIncluded = require("../core/generateIncluded")
const loadDockerfile = require("../core/loadDockerfile")
const loadEnvFileAndPrefix = require("../core/loadEnvFileAndPrefix")
const resolveSource = require("../sources/resolveSource")

module.exports = (
  {
    nestingLevel = 0,
    dockerContext,
    parentSource,
    relativeFilePath,
    scope,
    includeChain,
    maxIncludeDepth,
  },
  includeType = null,
) =>
  async function processInclude(instruction) {
    const includePathRelative = Array.isArray(instruction.args)
      ? instruction.args[0]
      : instruction.args

    const isEnvInclude =
      includeType === "ARG" ||
      includeType === "ENV" ||
      includeType === "LABEL"

    const childSource = resolveSource(includePathRelative, {
      parentSource,
      dockerContext,
      defaultExtension: isEnvInclude ? ".env" : ".dockerfile",
    })

    const stageAlias = generateFilePathSlug(
      childSource.stageAliasBase(dockerContext),
    )

    let includedContent
    if (isEnvInclude) {
      includedContent = await loadEnvFileAndPrefix(
        childSource,
        `${includeType} `,
      )
    } else {
      includedContent = await loadDockerfile(childSource, {
        scope: [...scope],
        dockerContext,
        parentStageTarget: null,
        parentStageAlias: stageAlias,
        nestingLevel: nestingLevel + 1,
        isRootInclude: nestingLevel === 0,
        includeChain,
        maxIncludeDepth,
      })
    }

    return [
      generateIncluded({
        includePathRelative,
        relativeFilePath,
        includedContent,
        includingInstruction: "include",
      }),
    ]
  }
