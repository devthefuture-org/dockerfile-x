const path = require("path")
const fs = require("fs/promises")
const dotenv = require("dotenv")
const checkFileExists = require("../utils/checkFileExists")

const DEFAULT_EXTENSION = ".env"

async function resolveEnvFilePath(filePath) {
  if (await checkFileExists(filePath)) return filePath

  // try adding extension and read again
  if (path.extname(filePath) !== DEFAULT_EXTENSION) {
    const withExt = `${filePath}${DEFAULT_EXTENSION}`
    if (await checkFileExists(withExt)) return withExt
  }

  return null
}

function formatDockerInstruction(prefix, key, value) {
  const cleanKey = key.replace(/[^A-Z0-9_]/gi, "")
  const cleanValue = String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\$/g, "\\$")
    .replace(/"/g, '\\"')
    .replace(/`/g, "\\`")
    .replace(/\r?\n/g, "\\n\\\n")
  return `${prefix}${cleanKey}="${cleanValue}"`
}

module.exports = async function loadEnvFileAndPrefix(
  dockerContext,
  filePath,
  prefix = "",
) {
  const relativeFilePath = path.relative(dockerContext, filePath)
  const resolvedPath = await resolveEnvFilePath(filePath)

  if (!resolvedPath) {
    process.stdout.write(
      JSON.stringify({
        error: "missing-file",
        filename: relativeFilePath,
      }),
    )
    process.exit(2)
  }

  const envContent = await fs.readFile(resolvedPath, "utf-8")
  const envVars = dotenv.parse(envContent) || {}

  return Object.entries(envVars)
    .map(([key, value]) => formatDockerInstruction(prefix, key, value))
    .join("\n")
}
