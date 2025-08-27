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
  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i]

    // Determine start line (0-based) from available fields; fallback to 0
    const startIdx =
      (instruction.lineno && instruction.lineno - 1) ||
      (instruction.startLine && instruction.startLine - 1) ||
      (instruction.startline && instruction.startline - 1) ||
      (instruction.line && instruction.line - 1) ||
      0

    // Determine next instruction start (for fallback end bound)
    const next = instructions[i + 1]
    const nextStartIdx = next
      ? (next.lineno && next.lineno - 1) ||
        (next.startLine && next.startLine - 1) ||
        (next.startline && next.startline - 1) ||
        (next.line && next.line - 1) ||
        lines.length
      : lines.length

    // End index: prefer docker-file-parser's lineno (last line of instruction), else before next instruction
    const endIdx =
      instruction.lineno && Number.isInteger(instruction.lineno)
        ? instruction.lineno - 1
        : Math.max(startIdx, nextStartIdx - 1)

    // Recover the true start by scanning upward from endIdx until the header line (instruction keyword) is found
    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const startsWithName = (line, name) => {
      if (!name) return false
      const re = new RegExp(`^\\s*${escapeRegExp(name)}\\b`, "i")
      return re.test(line)
    }

    let startIdxScan = endIdx
    if (instruction.name !== "COMMENT") {
      while (
        startIdxScan >= 0 &&
        !startsWithName(lines[startIdxScan] || "", instruction.name)
      ) {
        startIdxScan--
      }
      if (startIdxScan < 0) {
        startIdxScan = startIdx
      }
    }

    const defaultRaw = lines.slice(startIdxScan, endIdx + 1).join("\n")

    if (instruction.name === "COMMENT") {
      if (removeSyntaxComments && syntaxCommentRegex.test(instruction.args)) {
        instruction.raw = ""
      } else {
        // Preserve exact original comment formatting (including indentation)
        instruction.raw = defaultRaw
      }
    } else if (instruction.name === "FROM") {
      // Normalize "AS" casing but keep args semantics
      instruction.args = instruction.args.replace(/(\s+)as(\s+)/gi, "$1AS$2")
      instruction.raw = generateRawInstruction(instruction)
    } else {
      // Preserve exact original formatting for all other instructions (e.g., RUN with continuations/indentation)
      instruction.raw = defaultRaw
    }
  }
  return instructions
}
