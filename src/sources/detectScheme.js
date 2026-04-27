const SCHEMES = {
  HTTP: "http",
  GIT: "git",
  OCI: "oci",
  LOCAL: "local",
}

function detectScheme(reference) {
  if (typeof reference !== "string") {
    return SCHEMES.LOCAL
  }
  if (/^git\+/i.test(reference)) {
    return SCHEMES.GIT
  }
  if (/^oci:\/\//i.test(reference)) {
    return SCHEMES.OCI
  }
  if (/^https?:\/\//i.test(reference)) {
    return SCHEMES.HTTP
  }
  return SCHEMES.LOCAL
}

detectScheme.SCHEMES = SCHEMES

module.exports = detectScheme
