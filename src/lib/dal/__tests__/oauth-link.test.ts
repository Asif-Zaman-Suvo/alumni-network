import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideSscLink } from "../../oauth-link-decision";

describe("decideSscLink", () => {
  it("merges onto a different VERIFIED owner", () => {
    assert.deepEqual(
      decideSscLink({
        viewerId: "stub",
        verifiedOwnerId: "alum-1",
        blockingOwnerId: null,
      }),
      { kind: "merge", targetUserId: "alum-1" },
    );
  });

  it("does not merge when the verified owner is the viewer themselves", () => {
    assert.deepEqual(
      decideSscLink({
        viewerId: "alum-1",
        verifiedOwnerId: "alum-1",
        blockingOwnerId: null,
      }),
      { kind: "submit_pending" },
    );
  });

  it("submits pending when no verified match and no conflict", () => {
    assert.deepEqual(
      decideSscLink({
        viewerId: "stub",
        verifiedOwnerId: null,
        blockingOwnerId: null,
      }),
      { kind: "submit_pending" },
    );
  });

  it("conflicts when another user already has a PENDING claim", () => {
    const result = decideSscLink({
      viewerId: "stub",
      verifiedOwnerId: null,
      blockingOwnerId: "other",
    });
    assert.equal(result.kind, "conflict");
  });

  it("prefers merge over pending conflict when a VERIFIED owner exists", () => {
    assert.deepEqual(
      decideSscLink({
        viewerId: "stub",
        verifiedOwnerId: "alum-1",
        blockingOwnerId: "other-pending",
      }),
      { kind: "merge", targetUserId: "alum-1" },
    );
  });

  it("allows resubmit path when the pending claim is the viewer themselves", () => {
    assert.deepEqual(
      decideSscLink({
        viewerId: "stub",
        verifiedOwnerId: null,
        blockingOwnerId: "stub",
      }),
      { kind: "submit_pending" },
    );
  });
});
