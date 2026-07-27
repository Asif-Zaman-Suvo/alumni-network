import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoSensitiveFields,
  canViewProfile,
  directoryVisibilityLevels,
  type PrivacyViewer,
} from "../privacy";

function viewer(partial: Partial<PrivacyViewer> & Pick<PrivacyViewer, "id">): PrivacyViewer {
  return {
    status: "VERIFIED",
    role: "ALUMNI",
    isVerified: true,
    isStaff: false,
    ...partial,
  };
}

describe("directoryVisibilityLevels", () => {
  it("hides PRIVATE profiles from ordinary verified alumni", () => {
    assert.deepEqual(directoryVisibilityLevels(viewer({ id: "a" })), [
      "PUBLIC",
      "MEMBERS_ONLY",
    ]);
  });

  it("lets staff see every visibility level", () => {
    assert.deepEqual(
      directoryVisibilityLevels(viewer({ id: "admin", role: "ADMIN", isStaff: true })),
      ["PUBLIC", "MEMBERS_ONLY", "PRIVATE"],
    );
  });
});

describe("canViewProfile", () => {
  const owner = {
    ownerId: "owner-1",
    visibility: "MEMBERS_ONLY" as const,
    ownerStatus: "VERIFIED" as const,
    ownerDeletedAt: null,
  };

  it("denies anonymous viewers on MEMBERS_ONLY profiles", () => {
    assert.equal(canViewProfile(null, owner).allowed, false);
  });

  it("allows anonymous viewers on PUBLIC profiles", () => {
    assert.equal(
      canViewProfile(null, { ...owner, visibility: "PUBLIC" }).allowed,
      true,
    );
  });

  it("allows pending viewers on PUBLIC profiles via direct link", () => {
    // PUBLIC is visible to anyone; the proxy keeps pending users off the directory,
    // but a direct link to a PUBLIC profile remains allowed.
    assert.equal(
      canViewProfile(
        viewer({ id: "pending", status: "PENDING", isVerified: false }),
        { ...owner, visibility: "PUBLIC" },
      ).allowed,
      true,
    );
  });

  it("denies pending viewers on MEMBERS_ONLY profiles", () => {
    assert.equal(
      canViewProfile(
        viewer({ id: "pending", status: "PENDING", isVerified: false }),
        owner,
      ).allowed,
      false,
    );
  });

  it("allows verified alumni on MEMBERS_ONLY profiles", () => {
    assert.equal(canViewProfile(viewer({ id: "peer" }), owner).allowed, true);
  });

  it("denies verified alumni on PRIVATE profiles they do not own", () => {
    assert.equal(
      canViewProfile(viewer({ id: "peer" }), { ...owner, visibility: "PRIVATE" }).allowed,
      false,
    );
  });

  it("allows the owner to see their own PRIVATE profile", () => {
    const result = canViewProfile(viewer({ id: "owner-1" }), {
      ...owner,
      visibility: "PRIVATE",
    });
    assert.equal(result.allowed, true);
    assert.equal(result.isOwnProfile, true);
  });

  it("hides deleted owners from everyone except themselves", () => {
    assert.equal(
      canViewProfile(viewer({ id: "peer" }), {
        ...owner,
        ownerDeletedAt: new Date(),
      }).allowed,
      false,
    );
  });

  it("hides unverified owners from the public", () => {
    assert.equal(
      canViewProfile(viewer({ id: "peer" }), {
        ...owner,
        visibility: "PUBLIC",
        ownerStatus: "PENDING",
      }).allowed,
      false,
    );
  });
});

describe("assertNoSensitiveFields", () => {
  it("passes on a clean directory payload", () => {
    assert.doesNotThrow(() =>
      assertNoSensitiveFields({
        slug: "ayesha-rahman-0",
        displayName: "Ayesha Rahman",
        company: "bKash",
      }),
    );
  });

  it("throws when an SSC field appears on a public payload", () => {
    assert.throws(
      () => assertNoSensitiveFields({ displayName: "A", sscRoll: "123456" }),
      /sscRoll/,
    );
  });

  it("throws when a password hash appears on a public payload", () => {
    assert.throws(
      () => assertNoSensitiveFields({ displayName: "A", passwordHash: "$2a$..." }),
      /passwordHash/,
    );
  });
});
