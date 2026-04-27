const { INCLUDE_DEPTH_EXCEEDED } = require("./codes")

class IncludeDepthExceededError extends Error {
  constructor(depth, max, chain) {
    super(
      `Include depth exceeded: depth=${depth} max=${max}. Chain: ${chain.join(" -> ")}`,
    )
    this.code = INCLUDE_DEPTH_EXCEEDED
    this.depth = depth
    this.max = max
    this.chain = chain
  }
}

module.exports = IncludeDepthExceededError
