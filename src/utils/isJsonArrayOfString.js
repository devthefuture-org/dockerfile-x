module.exports = function isJsonArrayOfString(cmd) {
  try {
    var json = JSON.parse(cmd.rest)
  } catch (e) {
    return false
  }
  if (!Array.isArray(json)) {
    return false
  }
  if (
    !json.every(function (entry) {
      return typeof entry === "string"
    })
  ) {
    return false
  }

  return true
}
