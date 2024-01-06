const testFixture = require("./common/testFixture")

describe("INCLUDE", () => {
  it("include", async () => {
    await testFixture("include")
  })
})

describe("FROM", () => {
  it("from", async () => {
    await testFixture("from")
  })

  it("fromStageAlias", async () => {
    await testFixture("fromStageAlias")
  })

  it("fromWithTarget", async () => {
    await testFixture("fromWithTarget")
  })

  it("fromWithTargetStageAlias", async () => {
    await testFixture("fromWithTargetStageAlias")
  })

  it("mountFrom", async () => {
    await testFixture("mountFrom")
  })
})

describe("COPY", () => {
  it("copyFrom", async () => {
    await testFixture("copyFrom")
  })
  it("copyFromStage", async () => {
    await testFixture("copyFromStage")
  })
})
