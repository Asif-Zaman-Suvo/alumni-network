import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideSscLink, maskEmail } from "../../oauth-link-decision";

describe("decideSscLink", () => {
  it("blocks when SSC matches a different VERIFIED owner", () => {
    assert.deepEqual(
      decideSscLink({
        viewerId: "stub",
        verifiedOwnerId: "alum-1",
        blockingOwnerId: null,
      }),
      { kind: "block_existing", targetUserId: "alum-1" },
    );
  });

  it("does not block when the verified owner is the viewer themselves", () => {
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

  it("prefers block_existing over pending conflict when a VERIFIED owner exists", () => {
    assert.deepEqual(
      decideSscLink({
        viewerId: "stub",
        verifiedOwnerId: "alum-1",
        blockingOwnerId: "other-pending",
      }),
      { kind: "block_existing", targetUserId: "alum-1" },
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

describe("maskEmail", () => {
  it("shows first two and last two of the local part", () => {
    assert.equal(maskEmail("asif.zaman.suvo@gmail.com"), "as***vo@gmail.com");
    assert.equal(maskEmail("alumni@gmail.com"), "al***ni@gmail.com");
  });

  it("handles short local parts", () => {
    assert.equal(maskEmail("ab@school.edu"), "ab***@school.edu");
    assert.equal(maskEmail("a@school.edu"), "a***@school.edu");
  });

  it("returns a safe fallback for malformed input", () => {
    assert.equal(maskEmail("not-an-email"), "***");
    assert.equal(maskEmail("@missing-local.com"), "***");
  });
});
