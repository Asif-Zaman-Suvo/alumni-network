import type { Page } from "@playwright/test";

export const SEED_PASSWORD = "password123";
export const ADMIN_EMAIL = "admin@school.test";

/** Seeded accounts, one per verification status, so gating can be asserted per state. */
export const SEED_ACCOUNTS = {
  verified: "alumni0@example.test",
  pending: "pending0@example.test",
  rejected: "rejected0@example.test",
} as const;

export async function signIn(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  // Matched on pathname because sign-out redirects via the configured auth URL, whose host need not
  // be the baseURL host a relative pattern would resolve against.
  await page.waitForURL((url) => url.pathname === "/");
}

/**
 * Opens the email signup form on `/register`.
 *
 * The page leads with Google and keeps the email fields behind a button, so navigating there is not
 * enough to reach them.
 */
export async function openEmailSignupForm(page: Page) {
  await page.goto("/register");
  await page.getByRole("button", { name: "Sign up with email instead" }).click();
  await page.getByLabel("Full name").waitFor();
}

/**
 * Fresh SSC identity per call. These are unique per alumnus in the database, so a fixed pair only
 * registers once and every later run is rejected as a duplicate.
 */
export function uniqueSscDetails() {
  return {
    roll: String(700_000 + Math.floor(Math.random() * 99_999)),
    registration: String(1_500_000_000 + Math.floor(Math.random() * 99_999_999)),
  };
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.test`;
}
