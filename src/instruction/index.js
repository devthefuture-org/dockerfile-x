const from = require("./from")
const fromParam = require("./fromParam")
const include = require("./include")
const _default = require("./_default")

module.exports = (processingContext) => ({
  FROM: from(processingContext),
  COPY: fromParam(processingContext),
  ADD: fromParam(processingContext),
  INCLUDE: include(processingContext),
  _DEFAULT: _default(processingContext),
})
