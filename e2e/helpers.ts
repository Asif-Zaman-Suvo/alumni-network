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
  await page.waitForURL("/");
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.test`;
}
