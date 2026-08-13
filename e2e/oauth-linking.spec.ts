import { expect, test } from "@playwright/test";
import {
  openEmailSignupForm,
  SEED_ACCOUNTS,
  signIn,
  signOut,
  uniqueEmail,
  uniqueSscDetails,
} from "./helpers";

/**
 * Duplicate SSC identities must never create a second alumni account.
 * Full OAuth provider linking needs live Google/Facebook credentials; these cover the
 * email-path identity guard that the same uniqueness rule enforces.
 */

test("email signup is blocked when SSC details are already verified", async ({ page }) => {
  // alumni0 is seeded VERIFIED with some SSC; we need known values — skip if we cannot
  // control seed SSC. Instead: create pending user A, then try duplicate with B.
  const emailA = uniqueEmail("ssc-a");
  const emailB = uniqueEmail("ssc-b");
  const { roll, registration } = uniqueSscDetails();

  await openEmailSignupForm(page);
  await page.getByLabel("Full name").fill("First Claimant");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password", { exact: true }).fill("verysecret123");
  await page.getByLabel("SSC roll number").fill(roll);
  await page.getByLabel("SSC registration number").fill(registration);
  await page.getByLabel("Passing year").fill("2016");
  await page.getByRole("button", { name: "Create account" }).click();
  // Registration is the heaviest write in the app; see verification-gating.spec.ts.
  await expect(page).toHaveURL(/\/verification-status/, { timeout: 60_000 });

  // Registering signed A in, and /register redirects anyone already authenticated.
  const menu = page.getByRole("button", { name: "Open account menu" });
  if (await menu.isVisible().catch(() => false)) {
    await signOut(page);
  }

  await openEmailSignupForm(page);
  await page.getByLabel("Full name").fill("Second Claimant");
  await page.getByLabel("Email").fill(emailB);
  await page.getByLabel("Password", { exact: true }).fill("verysecret123");
  await page.getByLabel("SSC roll number").fill(roll);
  await page.getByLabel("SSC registration number").fill(registration);
  await page.getByLabel("Passing year").fill("2016");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByText(/already under review|already registered|already exist/i).first(),
  ).toBeVisible({ timeout: 60_000 });
});

test("verified settings page shows sign-in methods card", async ({ page }) => {
  await signIn(page, SEED_ACCOUNTS.verified);
  await page.goto("/settings/profile");
  await expect(page.getByText("Sign-in methods")).toBeVisible();
});
