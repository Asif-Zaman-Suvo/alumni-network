/**
 * The audit vocabulary, kept free of Prisma and Auth.js so both the server writers and the
 * browser monitor can import it without pulling a database client into the bundle.
 *
 * Authentication events use SCREAMING_SNAKE_CASE; the pre-existing staff mutations use dotted
 * lowercase. That split is deliberate — `action` stays a free-form string in the database, and
 * the two families are visually distinguishable in the log without needing a second column.
 */

export const AUTH_AUDIT_ACTIONS = {
  loginSuccess: "LOGIN_SUCCESS",
  loginFailed: "LOGIN_FAILED",
  logout: "LOGOUT",
  sessionExpired: "SESSION_EXPIRED",
  sessionRevoked: "SESSION_REVOKED",
} as const;

export type AuthAuditAction = (typeof AUTH_AUDIT_ACTIONS)[keyof typeof AUTH_AUDIT_ACTIONS];

/** Lifecycle events are one-per-session; the database enforces this with a partial unique index. */
export const SESSION_LIFECYCLE_ACTIONS: readonly AuthAuditAction[] = [
  AUTH_AUDIT_ACTIONS.loginSuccess,
  AUTH_AUDIT_ACTIONS.logout,
  AUTH_AUDIT_ACTIONS.sessionExpired,
  AUTH_AUDIT_ACTIONS.sessionRevoked,
];

export const AUTH_AUDIT_ACTION_VALUES: readonly AuthAuditAction[] =
  Object.values(AUTH_AUDIT_ACTIONS);

export function isAuthAuditAction(value: string): value is AuthAuditAction {
  return (AUTH_AUDIT_ACTION_VALUES as readonly string[]).includes(value);
}

/**
 * Coarse causes. These are the only values written to `AuditLog.reason`: a raw exception
 * message could carry a stack trace or a fragment of the submitted credential.
 */
export const AUDIT_REASONS = {
  invalidCredentials: "invalid_credentials",
  rateLimited: "rate_limited",
  malformedInput: "malformed_input",
  accountSuspended: "account_suspended",
  accountClosed: "account_closed",
  passwordReset: "password_reset",
  adminRevoked: "admin_revoked",
  onboardingConflict: "onboarding_conflict",
  maxAgeReached: "max_age_reached",
} as const;

export type AuditReason = (typeof AUDIT_REASONS)[keyof typeof AUDIT_REASONS];

export const AUTH_PROVIDERS = {
  credentials: "credentials",
  google: "google",
  facebook: "facebook",
  /** Machine-initiated, e.g. the expiry sweep. No human actor. */
  system: "system",
} as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];

/** Human-readable labels for the admin monitor. */
export const AUTH_AUDIT_ACTION_LABELS: Record<AuthAuditAction, string> = {
  LOGIN_SUCCESS: "Signed in",
  LOGIN_FAILED: "Sign-in failed",
  LOGOUT: "Signed out",
  SESSION_EXPIRED: "Session expired",
  SESSION_REVOKED: "Session revoked",
};

export function auditActionLabel(action: string): string {
  return isAuthAuditAction(action) ? AUTH_AUDIT_ACTION_LABELS[action] : action;
}
