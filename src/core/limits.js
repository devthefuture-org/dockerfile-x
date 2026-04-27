const DEFAULT_MAX_INCLUDE_DEPTH = 32

// Throws on garbage/non-positive input, matching the CLI flag's behavior so
// `DOCKERFILEX_MAX_INCLUDE_DEPTH=0` and `--max-include-depth 0` fail the same
// way. Returns undefined when the env var is unset.
function getMaxIncludeDepthFromEnv() {
  const raw = process.env.DOCKERFILEX_MAX_INCLUDE_DEPTH
  if (raw === undefined || raw === "") return undefined
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1 || String(n) !== raw.trim()) {
    throw new Error(
      `DOCKERFILEX_MAX_INCLUDE_DEPTH must be a positive integer (got "${raw}")`,
    )
  }
  return n
}

module.exports = {
  DEFAULT_MAX_INCLUDE_DEPTH,
  getMaxIncludeDepthFromEnv,
}
