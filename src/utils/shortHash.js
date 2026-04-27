const crypto = require("crypto")

// SHA-256 (truncated to `length` hex chars) is collision-resistant well past
// the truncation budget. Default 16 hex chars = 64 bits of resistance, which
// is fine for per-user cache filenames; bump `length` for keys that must
// resist a chosen-collision attacker.
module.exports = function shortHash(input, length = 16) {
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, length)
}
