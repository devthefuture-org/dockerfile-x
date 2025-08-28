const { parse } = require("docker-file-parser")

const syntaxCommentRegex = require("../regex/syntaxComment")
const generateRawInstruction = require("../lib/generateRawInstruction")

module.exports = function parseDockerfile(content, options = {}) {
  const { removeSyntaxComments = true, ...parseOptions } = options
  const instructions = parse(content, {
    includeComments: true,
    ...parseOptions,
  })
  const lines = content.split(/\r?\n/)

  // Get 0-based start line index from instruction metadata
  // (prefer header fields over lineno)
  const getStartLineIndex = (instruction) => {
    for (const key of ["lineno", "startLine", "startline", "line"]) {
      if (instruction[key]) return instruction[key] - 1
    }
    return 0
  }

  // Get raw text from lines[start..end]
  const getRaw = (start, end) => lines.slice(start, end + 1).join("\n")

  // Check if line starts with instruction
  const startsWithInstruction = (line, name) => {
    if (!name) return false
    const token = (line || "").replace(/^\s+/, "").split(/\s+/, 1)[0]
    return token.toUpperCase() === String(name).toUpperCase()
  }

  // Extract here-doc delimiter token from args
  const getHereDocDelimiter = (args) => {
    const text = String(args ?? "")
    const m = text.match(/<<-?\s*(['"]?)([A-Za-z0-9_]+)\1/)
    return m ? m[2] : null
  }

  // Find the closing line of a here-doc block
  const findHereDocClose = (startIndex, delimiter) => {
    for (let j = startIndex + 1; j < instructions.length; j++) {
      const seg = instructions[j]
      const segRaw = seg.raw != null ? String(seg.raw).trim() : ""
      if (seg.name === delimiter || segRaw === delimiter) {
        return { closeIndex: j, closeLineIdx: getStartLineIndex(seg) }
      }
    }
    return null
  }

  const results = []
  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i]
    const name = instruction.name.toUpperCase()

    if (
      name === "COMMENT" &&
      removeSyntaxComments &&
      syntaxCommentRegex.test(instruction.args)
    ) {
      // Remove syntax comment
      continue
    }

    if (name === "FROM") {
      // Normalize "AS" casing but keep args semantics
      if (typeof instruction.args === "string") {
        instruction.args = instruction.args.replace(/(\s+)as(\s+)/g, "$1AS$2")
      }
      instruction.raw = generateRawInstruction(instruction)
    }

    // Determine start line (0-based), end line from available fields; fallback to 0
    let startIdx = getStartLineIndex(instruction)
    const endIdx = startIdx // Default to the same line as the start line

    // Find the corresponding start line that really starts with the instruction
    if (name !== "COMMENT") {
      while (startIdx > 0 && !startsWithInstruction(lines[startIdx], name)) {
        startIdx--
      }
    }

    // Merge multi-line instructions (RUN, ARG, ENV, etc.)
    let closeIndex = i
    let closeLineIdx = endIdx

    // Check for here-doc in RUN instructions
    if (name === "RUN") {
      const delimiter = getHereDocDelimiter(instruction.args)
      if (delimiter) {
        const close = findHereDocClose(i, delimiter)
        if (close) {
          closeIndex = close.closeIndex
          closeLineIdx = close.closeLineIdx
        }
      }
    }

    // Update instruction metadata
    instruction.lineno = startIdx + 1
    instruction.raw = getRaw(startIdx, closeLineIdx)

    // Skip merged child instructions (i+1 ... closeIndex)
    if (closeIndex > i) i = closeIndex

    results.push(instruction)
  }

  return results
}
