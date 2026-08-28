import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closedAccountEmail, emailBlocksRegistration } from "../closed-account";

describe("emailBlocksRegistration", () => {
  it("blocks a live account", () => {
    assert.equal(emailBlocksRegistration({ deletedAt: null }), true);
  });

  it("does not block a closed account", () => {
    assert.equal(emailBlocksRegistration({ deletedAt: new Date() }), false);
  });

  it("does not block a missing address", () => {
    assert.equal(emailBlocksRegistration(null), false);
  });
});

describe("closedAccountEmail", () => {
  it("embeds the user id so two closures never collide", () => {
    const a = closedAccountEmail("cmtd6vcgm0001hbl2h94xavlz");
    const b = closedAccountEmail("cmtc3f0660003hbmm2jc0e1gq");
    assert.notEqual(a, b);
    assert.match(a, /cmtd6vcgm0001hbl2h94xavlz/);
    assert.match(a, /@deleted\.invalid$/);
  });
});
