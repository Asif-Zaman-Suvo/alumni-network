import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashAuditSubject,
  sanitiseIpAddress,
  sanitiseUserAgent,
  USER_AGENT_MAX_LENGTH,
} from "../../audit-redaction";

const SECRET = "test-secret-at-least-32-characters-long";

describe("hashAuditSubject", () => {
  it("never returns the address itself", () => {
    const email = "alum@example.com";
    const hash = hashAuditSubject(email, SECRET);
    assert.equal(hash.includes("alum"), false);
    assert.equal(hash.includes("example"), false);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("is stable across case and surrounding whitespace, so repeat attempts correlate", () => {
    const expected = hashAuditSubject("alum@example.com", SECRET);
    assert.equal(hashAuditSubject("ALUM@Example.com", SECRET), expected);
    assert.equal(hashAuditSubject("  alum@example.com  ", SECRET), expected);
  });

  it("separates addresses", () => {
    assert.notEqual(
      hashAuditSubject("a@example.com", SECRET),
      hashAuditSubject("b@example.com", SECRET),
    );
  });

  it("stops correlating once the key is rotated", () => {
    assert.notEqual(
      hashAuditSubject("alum@example.com", SECRET),
      hashAuditSubject("alum@example.com", `${SECRET}-rotated`),
    );
  });
});

describe("sanitiseIpAddress", () => {
  it("takes the original client from a proxy chain", () => {
    assert.equal(sanitiseIpAddress("203.0.113.7, 70.41.3.18, 150.172.238.178"), "203.0.113.7");
  });

  it("keeps a bare address and an IPv6 address", () => {
    assert.equal(sanitiseIpAddress("203.0.113.7"), "203.0.113.7");
    assert.equal(
      sanitiseIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334"),
      "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    );
  });

  it("drops rather than truncates an implausible value", () => {
    // A truncated address is actively misleading in an audit trail, unlike a missing one.
    assert.equal(sanitiseIpAddress("x".repeat(60)), null);
  });

  it("returns null for empty and missing input", () => {
    assert.equal(sanitiseIpAddress(""), null);
    assert.equal(sanitiseIpAddress(null), null);
    assert.equal(sanitiseIpAddress(undefined), null);
    assert.equal(sanitiseIpAddress("   "), null);
  });
});

describe("sanitiseUserAgent", () => {
  it("caps length so a hostile header cannot bloat the row", () => {
    const result = sanitiseUserAgent("a".repeat(5000));
    assert.equal(result?.length, USER_AGENT_MAX_LENGTH);
  });

  it("collapses whitespace", () => {
    assert.equal(sanitiseUserAgent("Mozilla/5.0   (X11;\n Linux)"), "Mozilla/5.0 (X11; Linux)");
  });

  it("returns null for empty and missing input", () => {
    assert.equal(sanitiseUserAgent(""), null);
    assert.equal(sanitiseUserAgent("   "), null);
    assert.equal(sanitiseUserAgent(null), null);
    assert.equal(sanitiseUserAgent(undefined), null);
  });
});
