const axios = require("axios")
const fs = require("fs/promises")
const path = require("path")
const os = require("os")

async function getCachedData(filepath) {
  const data = await fs.readFile(filepath, "utf-8")
  const { content, headers } = JSON.parse(data)
  return { content, headers }
}

module.exports = async function downloadWithCache(url) {
  const homeDirectory = os.homedir()
  const cacheDirectory = path.join(homeDirectory, ".dockerfile-x/cache")

  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory, { recursive: true })
  }

  const filename = encodeURIComponent(url)
  const filepath = path.join(cacheDirectory, filename)

  try {
    const { content, headers } = await getCachedData(filepath)

    // Use cached headers to create request headers
    const requestHeaders = {}
    if (headers["last-modified"]) {
      requestHeaders["If-Modified-Since"] = headers["last-modified"]
    }
    if (headers.etag) {
      requestHeaders["If-None-Match"] = headers.etag
    }

    const response = await axios.get(url, { headers: requestHeaders })

    // If content has not changed, return the cached content
    if (response.status === 304) {
      return content
    } else {
      // Save the updated content and headers to cache
      await fs.writeFile(
        filepath,
        JSON.stringify({
          content: response.data,
          headers: {
            "last-modified": response.headers["last-modified"],
            etag: response.headers.etag,
          },
        }),
      )
      return response.data
    }
  } catch (error) {
    // If file not in cache or other error occurred, download the URL
    const response = await axios.get(url)
    await fs.writeFile(
      filepath,
      JSON.stringify({
        content: response.data,
        headers: {
          "last-modified": response.headers["last-modified"],
          etag: response.headers.etag,
        },
      }),
    )
    return response.data
  }
}
