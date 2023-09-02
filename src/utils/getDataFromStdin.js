module.exports = async function getDataFromStdin() {
  return new Promise((resolve) => {
    let inputData = ""
    process.stdin.on("data", (data) => {
      inputData += data
    })

    process.stdin.on("end", () => {
      resolve(inputData)
    })
  })
}
