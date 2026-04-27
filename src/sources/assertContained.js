const path = require("path")
const fs = require("fs/promises")

const { PATH_TRAVERSAL } = require("../errors/codes")

function throwTraversal(displayRef, child) {
  const err = new Error(
    `path-traversal: ${displayRef || child} escapes its source directory`,
  )
  err.code = PATH_TRAVERSAL
  err.ref = displayRef || child
  throw err
}

/**
 * Throw a typed error if `child` resolves outside of `parent` lexically.
 * Both arguments must be absolute paths.
 */
function assertContained(parent, child, displayRef) {
  const rel = path.relative(parent, child)
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) return
  throwTraversal(displayRef, child)
}

/**
 * Realpath-aware variant: resolves symlinks under `child` before checking
 * containment. Use this for files extracted from attacker-controlled archives
 * (git repos, OCI artifacts) where the cache directory may legitimately exist
 * but a symlink inside it could point outside.
 *
 * If `child` does not exist yet, falls back to lexical check.
 */
async function assertContainedReal(parent, child, displayRef) {
  let realChild
  try {
    realChild = await fs.realpath(child)
  } catch (err) {
    if (err.code === "ENOENT") {
      assertContained(parent, child, displayRef)
      return
    }
    throw err
  }
  const realParent = await fs.realpath(parent)
  const rel = path.relative(realParent, realChild)
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) return
  throwTraversal(displayRef, child)
}

module.exports = assertContained
module.exports.assertContainedReal = assertContainedReal
