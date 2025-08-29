const from = require("./from")
const fromParam = require("./fromParam")
const include = require("./include")
const _default = require("./_default")

module.exports = (processingContext) => ({
  FROM: from(processingContext),
  COPY: fromParam(processingContext),
  ADD: fromParam(processingContext),
  INCLUDE: include(processingContext),
  INCLUDE_ARGS: include(processingContext, "ARG"),
  INCLUDE_ENVS: include(processingContext, "ENV"),
  INCLUDE_LABELS: include(processingContext, "LABEL"),
  _DEFAULT: _default(processingContext),
})
