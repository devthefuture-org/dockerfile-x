const path = require("path")

/**
 * Run `tryFn(candidatePath)` once; if it returns falsy and the path lacks the
 * default extension, retry once with the extension appended. Returns whatever
 * tryFn returns, or null if both attempts fail.
 */
module.exports = async function tryWithExtension(filePath, defaultExtension, tryFn) {
  // `tryFn` returns null/undefined to signal a miss. Anything else (including
  // empty string content from a zero-byte file) is a hit and must be returned
  // verbatim — don't truthy-check it.
  const first = await tryFn(filePath)
  if (first !== null && first !== undefined) return first
  if (!defaultExtension) return null
  if (path.extname(filePath) === defaultExtension) return null
  return tryFn(filePath + defaultExtension)
}
