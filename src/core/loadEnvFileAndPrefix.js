const dotenv = require("dotenv")

function formatDockerInstruction(prefix, key, value) {
  const cleanKey = key.replace(/[^A-Z0-9._-]/gi, "")
  const cleanValue = String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\$/g, "\\$")
    .replace(/"/g, '\\"')
    .replace(/`/g, "\\`")
    .replace(/\r?\n/g, "\\n\\\n")
  return `${prefix}${cleanKey}="${cleanValue}"`
}

module.exports = async function loadEnvFileAndPrefix(source, prefix = "") {
  const envContent = await source.read()
  const envVars = dotenv.parse(envContent) || {}

  return Object.entries(envVars)
    .map(([key, value]) => formatDockerInstruction(prefix, key, value))
    .join("\n")
}
