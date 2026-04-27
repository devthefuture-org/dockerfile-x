const axios = require("axios")
const fs = require("fs/promises")
const net = require("net")
const path = require("path")
const os = require("os")

const ensureDir = require("../utils/ensureDir")
const shortHash = require("../utils/shortHash")

const DEFAULT_HTTP_TIMEOUT_MS = 30_000
// Dockerfiles and .env files are text and typically under 100 KiB. 1 MiB is a
// generous cap that still rejects gigabyte payloads from a hostile server.
// Override via DOCKERFILEX_MAX_HTTP_BYTES.
const DEFAULT_MAX_HTTP_BYTES = 1 * 1024 * 1024
const DEFAULT_MAX_REDIRECTS = 5

function getHttpTimeoutMs() {
  const raw = process.env.DOCKERFILEX_HTTP_TIMEOUT_MS
  if (!raw) return DEFAULT_HTTP_TIMEOUT_MS
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HTTP_TIMEOUT_MS
  return n
}

function getMaxHttpBytes() {
  const raw = process.env.DOCKERFILEX_MAX_HTTP_BYTES
  if (!raw) return DEFAULT_MAX_HTTP_BYTES
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_HTTP_BYTES
  return n
}

function getMaxRedirects() {
  const raw = process.env.DOCKERFILEX_MAX_REDIRECTS
  if (raw === undefined || raw === "") return DEFAULT_MAX_REDIRECTS
  const n = Number(raw)
  // Allow 0 (disable redirects) but reject NaN/negative.
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_REDIRECTS
  return n
}

// Strip an IPv6 zone suffix (`fe80::1%eth0`) and brackets before classification.
function normalizeIp(ip) {
  let s = ip
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1)
  const pct = s.indexOf("%")
  if (pct !== -1) s = s.slice(0, pct)
  return s
}

// Classify a literal IP address as "private" for SSRF policy purposes:
// loopback, RFC1918, link-local, unique-local v6, IPv4-mapped-v6 of the above.
// Hostnames are not classified — DNS-resolved private addresses are out of
// scope for the synchronous beforeRedirect hook (see policy comment below).
function isPrivateIp(ip) {
  const s = normalizeIp(ip)
  const fam = net.isIP(s)
  if (fam === 4) return isPrivateIPv4(s)
  if (fam === 6) return isPrivateIPv6(s)
  return false
}

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map((n) => Number.parseInt(n, 10))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8 unspecified
  if (a === 10) return true // RFC1918
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local (incl. 169.254.169.254 cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 192 && b === 168) return true // RFC1918
  if (a >= 224) return true // multicast/reserved
  return false
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase()
  if (lower === "::" || lower === "::1") return true
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true // fe80::/10
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true // fc00::/7 ULA
  // IPv4-mapped IPv6: ::ffff:a.b.c.d — classify by the embedded v4
  const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4mapped) return isPrivateIPv4(v4mapped[1])
  return false
}

// Parse the comma-separated allowlist from env. Each entry is one of:
//   - exact IPv4 literal: `192.168.1.10`
//   - IPv4 CIDR:          `10.0.0.0/8`
//   - exact hostname:     `internal.corp.local`
//   - suffix wildcard:    `*.corp.local` (matches any hostname ending in `.corp.local`)
// Hostname matching is case-insensitive. IPv6 CIDR isn't parsed; literal IPv6
// allowlisting via exact-match is supported.
function parseRedirectAllowlist(raw) {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseAllowlistPattern)
}

function parseAllowlistPattern(p) {
  const cidr = p.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/)
  if (cidr) {
    const bits = Number.parseInt(cidr[2], 10)
    if (
      net.isIP(cidr[1]) !== 4 ||
      !Number.isInteger(bits) ||
      bits < 0 ||
      bits > 32
    ) {
      throw new Error(
        `invalid CIDR in DOCKERFILEX_REDIRECT_ALLOWLIST: ${p}`,
      )
    }
    return { kind: "cidr4", ip: cidr[1], bits }
  }
  if (net.isIP(p)) return { kind: "ip", ip: p.toLowerCase() }
  if (p.startsWith("*.")) {
    return { kind: "suffix", suffix: p.slice(1).toLowerCase() }
  }
  return { kind: "host", host: p.toLowerCase() }
}

function ipv4ToInt(ip) {
  const parts = ip.split(".").map((n) => Number.parseInt(n, 10))
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  )
}

function matchesAllowlist(hostname, list) {
  if (list.length === 0) return false
  const lh = hostname.toLowerCase()
  const fam = net.isIP(hostname)
  for (const p of list) {
    if (p.kind === "host" && p.host === lh) return true
    if (p.kind === "suffix" && lh.endsWith(p.suffix)) return true
    if (p.kind === "ip" && p.ip === lh) return true
    if (p.kind === "cidr4" && fam === 4) {
      const mask = p.bits === 0 ? 0 : (~0 << (32 - p.bits)) >>> 0
      if ((ipv4ToInt(hostname) & mask) === (ipv4ToInt(p.ip) & mask)) return true
    }
  }
  return false
}

function getRedirectAllowlist() {
  return parseRedirectAllowlist(process.env.DOCKERFILEX_REDIRECT_ALLOWLIST)
}

// Filesystem path components are typically capped at 255 bytes. Long URLs
// (encoded) blow past this; hash them past a safe threshold.
const MAX_CACHE_FILENAME_BYTES = 200

function cacheFilename(url) {
  const encoded = encodeURIComponent(url)
  if (Buffer.byteLength(encoded, "utf-8") <= MAX_CACHE_FILENAME_BYTES) {
    return encoded
  }
  return `h-${shortHash(url)}`
}

async function readCache(filepath) {
  try {
    const data = await fs.readFile(filepath, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
}

async function writeCache(filepath, payload) {
  await fs.writeFile(filepath, JSON.stringify(payload), "utf-8")
}

function getCacheDirectory() {
  return (
    process.env.DOCKERFILEX_CACHE_DIR ||
    path.join(os.homedir(), ".dockerfile-x", "cache")
  )
}

// Dedup concurrent fetches for the same URL — second caller awaits the first
// instead of racing on the same network round-trip and cache file.
const inflight = new Map()

// Network-level error codes that justify falling back to a stale cached copy.
// HTTP status errors (4xx/5xx) are NOT in this list: a URL that started 200
// and is now 404/401/410 must not silently return its old content.
const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNABORTED",
])

function isNetworkError(err) {
  if (!err) return false
  if (err.response) return false // server replied; not a network failure
  if (NETWORK_ERROR_CODES.has(err.code)) return true
  if (err.code === "ERR_NETWORK") return true
  return false
}

async function fetchOnce(url, extraHeaders) {
  const cacheDirectory = getCacheDirectory()
  await ensureDir(cacheDirectory)

  const filename = cacheFilename(url)
  const filepath = path.join(cacheDirectory, filename)

  const cached = await readCache(filepath)

  const conditional = {}
  if (cached?.headers) {
    if (cached.headers["last-modified"]) {
      conditional["If-Modified-Since"] = cached.headers["last-modified"]
    }
    if (cached.headers.etag) {
      conditional["If-None-Match"] = cached.headers.etag
    }
  }

  const maxBytes = getMaxHttpBytes()
  // Parse allowlist once per request (env may change between calls in tests).
  const allowlist = getRedirectAllowlist()
  const initialHost = new URL(url).host
  try {
    const response = await axios.get(url, {
      headers: { ...conditional, ...extraHeaders },
      responseType: "text",
      transformResponse: [(data) => data], // keep as raw string
      validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
      timeout: getHttpTimeoutMs(),
      // Cap response size — both `maxContentLength` (response.data buffer) and
      // `maxBodyLength` (request body, set defensively for redirect chains).
      // Without this, an attacker-controlled URL can stream gigabytes into
      // memory before timeout / writeCache.
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      // Redirect handling: explicit cap + scheme/downgrade + private-IP guard.
      // Without beforeRedirect, an attacker on `https://x` can redirect to
      // `http://x` (downgrade) or to internal services (SSRF — e.g.,
      // 169.254.169.254 cloud metadata). The cycle key is the *original* URL,
      // so the redirect target's bytes still get cached under it.
      //
      // Private-IP policy: cross-host redirects to a literal private IP
      // (loopback, RFC1918, link-local, ULA) are denied by default. Hostname
      // redirects whose DNS resolution lands on a private IP are NOT blocked
      // here (beforeRedirect is sync; resolving DNS in a separate codepath
      // wasn't worth the complexity given the threat model). To opt in, set
      // DOCKERFILEX_REDIRECT_ALLOWLIST="host1,*.corp.local,10.0.0.0/8".
      maxRedirects: getMaxRedirects(),
      beforeRedirect: (opts, { headers }) => {
        const location = headers && headers.location
        if (!location) return
        let next
        try {
          next = new URL(location, url)
        } catch {
          throw new Error(`invalid redirect target: ${location}`)
        }
        const fromProtocol = new URL(url).protocol
        if (fromProtocol === "https:" && next.protocol === "http:") {
          throw new Error(
            `refusing HTTPS→HTTP downgrade redirect: ${url} -> ${next.href}`,
          )
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          throw new Error(
            `refusing redirect to non-http(s) scheme: ${url} -> ${next.href}`,
          )
        }
        const sameHost = next.host === initialHost
        if (
          !sameHost &&
          isPrivateIp(next.hostname) &&
          !matchesAllowlist(next.hostname, allowlist)
        ) {
          throw new Error(
            `refusing cross-host redirect to private IP: ${url} -> ${next.href} (set DOCKERFILEX_REDIRECT_ALLOWLIST to opt in)`,
          )
        }
      },
    })

    if (response.status === 304 && cached) {
      return cached.content
    }

    const lastModified = response.headers["last-modified"]
    const etag = response.headers.etag
    const payload = {
      content: response.data,
      headers: {
        ...(lastModified ? { "last-modified": String(lastModified) } : {}),
        ...(etag ? { etag: String(etag) } : {}),
      },
    }
    await writeCache(filepath, payload)
    return response.data
  } catch (err) {
    // Only fall back to cached content on true network failures. HTTP 4xx/5xx
    // (an authoritative server response) must surface so callers see the
    // current state of the URL, not a stale snapshot.
    if (cached && isNetworkError(err)) return cached.content
    throw err
  }
}

// Stable key so two callers with identical headers actually share the fetch,
// while differing headers (e.g. one anonymous, one with an Authorization
// token) get distinct in-flight promises. JSON-encode to keep the key
// unambiguous when header values contain whitespace, `=`, `\n`, etc.
function inflightKey(url, headers) {
  const keys = Object.keys(headers).sort()
  if (keys.length === 0) return url
  const norm = keys.map((k) => [k.toLowerCase(), headers[k]])
  return `${url}\n${JSON.stringify(norm)}`
}

module.exports = function downloadWithCache(url, options = {}) {
  const { headers: extraHeaders = {} } = options
  const key = inflightKey(url, extraHeaders)
  let promise = inflight.get(key)
  if (promise) return promise
  promise = fetchOnce(url, extraHeaders).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, promise)
  return promise
}

module.exports.getCacheDirectory = getCacheDirectory
