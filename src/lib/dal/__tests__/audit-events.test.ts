import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditActionLabel,
  AUTH_AUDIT_ACTIONS,
  AUTH_AUDIT_ACTION_VALUES,
  isAuthAuditAction,
  SESSION_LIFECYCLE_ACTIONS,
} from "../../audit-events";

/**
 * These names are a persisted contract: they are written into `AuditLog.action` and matched by the
 * partial unique index in the migration. A rename that only touches TypeScript would silently stop
 * deduplicating lifecycle events, so the exact strings are asserted here.
 */
describe("authentication audit action names", () => {
  it("uses the exact event names the database index expects", () => {
    assert.equal(AUTH_AUDIT_ACTIONS.loginSuccess, "LOGIN_SUCCESS");
    assert.equal(AUTH_AUDIT_ACTIONS.loginFailed, "LOGIN_FAILED");
    assert.equal(AUTH_AUDIT_ACTIONS.logout, "LOGOUT");
    assert.equal(AUTH_AUDIT_ACTIONS.sessionExpired, "SESSION_EXPIRED");
    assert.equal(AUTH_AUDIT_ACTIONS.sessionRevoked, "SESSION_REVOKED");
  });

  it("treats every terminal event as a lifecycle event, and LOGIN_FAILED as not one", () => {
    // LOGIN_FAILED has no session, so it must not be deduplicated per session — repeated
    // failures are exactly the signal an operator needs to see.
    assert.equal(
      SESSION_LIFECYCLE_ACTIONS.includes(AUTH_AUDIT_ACTIONS.loginFailed),
      false,
    );
    assert.deepEqual([...SESSION_LIFECYCLE_ACTIONS].sort(), [
      "LOGIN_SUCCESS",
      "LOGOUT",
      "SESSION_EXPIRED",
      "SESSION_REVOKED",
    ]);
  });

  it("recognises its own actions and rejects staff actions", () => {
    for (const action of AUTH_AUDIT_ACTION_VALUES) {
      assert.equal(isAuthAuditAction(action), true, action);
    }
    assert.equal(isAuthAuditAction("verification.approve"), false);
    assert.equal(isAuthAuditAction("login_success"), false);
  });

  it("labels authentication actions and passes staff actions through unchanged", () => {
    assert.equal(auditActionLabel("LOGIN_SUCCESS"), "Signed in");
    assert.equal(auditActionLabel("verification.approve"), "verification.approve");
  });
});
