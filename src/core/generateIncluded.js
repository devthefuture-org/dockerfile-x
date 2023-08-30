module.exports = function generateIncluded({
  includePathRelative,
  relativeFilePath,
  includedContent,
}) {
  const attrs = {
    file: includePathRelative,
    includedBy: relativeFilePath,
  }
  const attrsStr = Object.entries(attrs)
    .reduce((acc, [key, value]) => {
      acc.push(`${key}="${value}"`)
      return acc
    }, [])
    .join(" ")

  return (
    "\n" +
    `# DOCKERFILE-X:START ${attrsStr}` +
    "\n" +
    includedContent +
    "\n" +
    `# DOCKERFILE-X:END ${attrsStr}` +
    "\n"
  )
}
