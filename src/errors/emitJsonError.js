// Emit a structured error on stdout and exit with code 2.
// Calling process.exit() immediately after process.stdout.write() can truncate
// the payload when stdout is a pipe (e.g. when consumed by the Go BuildKit
// frontend). Wait for the write to flush before exiting.
module.exports = function emitJsonErrorAndExit(payload) {
  const line = `${JSON.stringify(payload)}\n`
  process.stdout.write(line, () => {
    process.exit(2)
  })
}
