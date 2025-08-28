const testFixture = require("./common/testFixture")

describe("stage-name-truncation", () => {
  it("stage-name-truncation", async () => {
    await testFixture("stage-name-truncation")
  })
})

describe("dedup", () => {
  it("dedup", async () => {
    await testFixture("dedup")
  })
})

describe("issues", () => {
  it("include-target", async () => {
    await testFixture("issue1")
  })
  it("preserve-instructions", async () => {
    await testFixture("issue27")
  })
  it("preserve-environment-variables", async () => {
    await testFixture("issue28")
  })
})
