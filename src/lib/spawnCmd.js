const { execFile } = require("child_process")

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function getDefaultTimeout() {
  const raw = process.env.DOCKERFILEX_SUBPROCESS_TIMEOUT_MS
  if (!raw) return DEFAULT_TIMEOUT_MS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS
  return n
}

/**
 * Promise wrapper around child_process.execFile.
 * Captures stdout/stderr and surfaces stderr in the rejection message.
 * A timeout (default 5min, override via DOCKERFILEX_SUBPROCESS_TIMEOUT_MS or
 * options.timeout) prevents a hung git/oras invocation from blocking forever.
 */
module.exports = function spawnCmd(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      {
        maxBuffer: 64 * 1024 * 1024,
        timeout: getDefaultTimeout(),
        killSignal: "SIGKILL",
        ...options,
      },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout
          err.stderr = stderr
          // Truncate stderr in the message — `maxBuffer` is 64 MiB and a
          // misbehaving server could fill it. Full stderr stays on err.stderr
          // for callers that want to inspect it.
          const STDERR_MSG_LIMIT = 4096
          const truncated =
            stderr && stderr.length > STDERR_MSG_LIMIT
              ? `${stderr.slice(0, STDERR_MSG_LIMIT)}\n…[truncated]`
              : stderr
          err.message = `${bin} ${args.join(" ")} failed: ${err.message}\n${truncated}`
          reject(err)
          return
        }
        resolve({ stdout, stderr })
      },
    )
  })
}

module.exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS
