import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSender, unquoteEnvValue } from "../email-sender";

describe("parseSender", () => {
  it("parses a display name and address", () => {
    assert.deepEqual(parseSender("Alumni Network <alumnishksc@gmail.com>"), {
      name: "Alumni Network",
      email: "alumnishksc@gmail.com",
    });
  });

  it("strips wrapping quotes copied from a .env file into Vercel", () => {
    assert.deepEqual(parseSender('"Alumni Network <alumnishksc@gmail.com>"'), {
      name: "Alumni Network",
      email: "alumnishksc@gmail.com",
    });
  });
});

describe("unquoteEnvValue", () => {
  it("leaves a bare API key alone", () => {
    assert.equal(unquoteEnvValue("xkeysib-abc"), "xkeysib-abc");
  });

  it("strips wrapping double quotes", () => {
    assert.equal(unquoteEnvValue('"xkeysib-abc"'), "xkeysib-abc");
  });
});
