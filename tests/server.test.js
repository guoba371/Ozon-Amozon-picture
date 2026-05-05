const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  buildImageEditsUrl,
  buildImageGenerationsUrl,
  buildResponsesUrl,
  dataUrlToFile,
} = require("../server");

describe("Responses API URL builder", () => {
  it("appends /v1/responses when the relay base URL has no version path", () => {
    assert.equal(
      buildResponsesUrl("https://timicc.com"),
      "https://timicc.com/v1/responses",
    );
  });

  it("does not duplicate /v1 when the relay base URL already includes it", () => {
    assert.equal(
      buildResponsesUrl("https://www.openclaudecode.cn/v1"),
      "https://www.openclaudecode.cn/v1/responses",
    );
  });
});

describe("Images API URL builders", () => {
  it("builds generation and edit URLs without duplicating /v1", () => {
    assert.equal(
      buildImageGenerationsUrl("https://www.openclaudecode.cn/v1"),
      "https://www.openclaudecode.cn/v1/images/generations",
    );
    assert.equal(
      buildImageEditsUrl("https://www.openclaudecode.cn/v1"),
      "https://www.openclaudecode.cn/v1/images/edits",
    );
  });

  it("builds generation and edit URLs when the base URL has no version path", () => {
    assert.equal(
      buildImageGenerationsUrl("https://timicc.com"),
      "https://timicc.com/v1/images/generations",
    );
    assert.equal(
      buildImageEditsUrl("https://timicc.com"),
      "https://timicc.com/v1/images/edits",
    );
  });
});

describe("image reference conversion", () => {
  it("converts a data URL to a File for image edit requests", async () => {
    const file = dataUrlToFile("data:image/png;base64,aGVsbG8=", "reference");
    const text = await file.text();

    assert.equal(file.name, "reference.png");
    assert.equal(file.type, "image/png");
    assert.equal(text, "hello");
  });
});
