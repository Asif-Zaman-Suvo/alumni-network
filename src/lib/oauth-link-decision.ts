/**
 * Pure SSC linking decisions — no Next.js / Prisma imports so unit tests stay free of
 * the request runtime.
 *
 * Onboarding never auto-merges a new Google stub onto an existing VERIFIED alumni.
 * That would create a second login path without the user proving ownership of the
 * registered email. Instead we block and send them to sign in with that account.
 */

export type SscLinkDecision =
  | { kind: "block_existing"; targetUserId: string }
  | { kind: "submit_pending" }
  | { kind: "conflict"; message: string };

/**
 * Pure decision for tests and for the onboarding submit path.
 * `verifiedOwnerId` / `blockingOwnerId` come from DB lookups; null means none.
 */
export function decideSscLink(input: {
  viewerId: string;
  verifiedOwnerId: string | null;
  /** Another user already has PENDING claim for this SSC identity. */
  blockingOwnerId: string | null;
}): SscLinkDecision {
  if (input.verifiedOwnerId) {
    if (input.verifiedOwnerId === input.viewerId) {
      // Should not happen for a fresh OAuth stub, but do not block yourself.
      return { kind: "submit_pending" };
    }
    return { kind: "block_existing", targetUserId: input.verifiedOwnerId };
  }

  if (input.blockingOwnerId && input.blockingOwnerId !== input.viewerId) {
    return {
      kind: "conflict",
      message:
        "Those SSC details are already under review for another account. Contact the alumni office if this is your identity.",
    };
  }

  return { kind: "submit_pending" };
}

/** Mask local-part as first2***last2 — e.g. asif.zaman.suvo@gmail.com → as***vo@gmail.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  let maskedLocal: string;
  if (local.length <= 1) {
    maskedLocal = `${local}***`;
  } else if (local.length <= 4) {
    maskedLocal = `${local.slice(0, 2)}***`;
  } else {
    maskedLocal = `${local.slice(0, 2)}***${local.slice(-2)}`;
  }

  return `${maskedLocal}@${domain}`;
}
