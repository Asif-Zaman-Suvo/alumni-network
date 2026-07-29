/**
 * Pure SSC linking decisions — no Next.js / Prisma imports so unit tests stay free of
 * the request runtime.
 */

export type SscLinkDecision =
  | { kind: "merge"; targetUserId: string }
  | { kind: "submit_pending" }
  | { kind: "conflict"; message: string };

/**
 * Pure decision for tests and for the onboarding submit path.
 * `verifiedOwnerId` / `blockingOwnerId` come from DB lookups; null means none.
 */
export function decideSscLink(input: {
  viewerId: string;
  verifiedOwnerId: string | null;
  /** Another user already has PENDING (or similar in-flight) claim for this SSC. */
  blockingOwnerId: string | null;
}): SscLinkDecision {
  if (input.verifiedOwnerId) {
    if (input.verifiedOwnerId === input.viewerId) {
      return { kind: "submit_pending" };
    }
    return { kind: "merge", targetUserId: input.verifiedOwnerId };
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
