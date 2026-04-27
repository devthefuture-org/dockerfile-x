const { INCLUDE_CYCLE } = require("./codes")

class IncludeCycleError extends Error {
  constructor(sourceKey, chain) {
    const fullChain = [...chain, sourceKey]
    super(`Include cycle detected: ${fullChain.join(" -> ")}`)
    this.code = INCLUDE_CYCLE
    this.sourceKey = sourceKey
    this.chain = fullChain
  }
}

module.exports = IncludeCycleError
