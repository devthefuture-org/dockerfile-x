module.exports = function parseDockerfileXStartComment(line) {
  const prefix = "# DOCKERFILE-X:START "

  if (!line.startsWith(prefix)) {
    return null
  }

  const keyValueString = line.slice(prefix.length)
  const keyValuePairs = keyValueString.split(/\s+/)
  const map = {}

  keyValuePairs.forEach((pair) => {
    const [key, value] = pair.split("=")
    if (key && value) {
      const cleanedValue = value.replace(/^["']|["']$/g, "")
      map[key] = cleanedValue
    }
  })
  return map
}
