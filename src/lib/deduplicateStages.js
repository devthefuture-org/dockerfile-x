const parseDockerfile = require("../lib/parseDockerfile")

module.exports = function deduplicateStages(dockerContent) {
  const instructions = parseDockerfile(dockerContent)

  let stages = []
  let currentStage = []

  instructions.forEach((command) => {
    // Check if the command is a 'FROM' command, indicating a new stage
    if (command.name === "FROM") {
      // If we already have commands in the current stage, push them to stages
      if (currentStage.length) {
        stages.push(currentStage)
        currentStage = []
      }
    }
    currentStage.push(command)
  })

  // Push the last stage if it's not empty
  if (currentStage.length) {
    stages.push(currentStage)
  }

  // Deduplicate stages
  const uniqueStagesSet = new Set(
    stages.map((stage) =>
      stage.map((instruction) => instruction.raw).join("\n"),
    ),
  )

  // Convert back to Dockerfile format
  const deduplicatedDockerfile = [...uniqueStagesSet].join("\n")

  return deduplicatedDockerfile
}
