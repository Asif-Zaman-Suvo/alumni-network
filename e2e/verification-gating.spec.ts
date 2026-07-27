import { expect, test } from "@playwright/test";
import { SEED_ACCOUNTS, signIn, uniqueEmail } from "./helpers";

/**
 * The core promise of the product: nobody sees alumni data until an administrator has
 * approved them. Each of these asserts one status transition in that gate.
 */

test("signup collects SSC details and lands the user in the review queue", async ({ page }) => {
  const email = uniqueEmail("signup");

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Test Alumnus");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("verysecret123");
  await page.getByLabel("SSC roll number").fill("654321");
  await page.getByLabel("SSC registration number").fill("1234509876");
  await page.getByLabel("Passing year").fill("2015");
  await page.getByRole("button", { name: "Create account" }).click();

  // Registration submits the claim in the same step, so the user goes straight to PENDING.
  await expect(page).toHaveURL(/\/verification-status/);
  await expect(page.getByText("Awaiting review")).toBeVisible();
});

test("a pending user cannot reach the directory", async ({ page }) => {
  await signIn(page, SEED_ACCOUNTS.pending);

  await page.goto("/directory");
  await expect(page).toHaveURL(/\/verification-status/);
  await expect(page.getByText("Your request is with our team")).toBeVisible();
});

test("a rejected user sees the reviewer note and can resubmit", async ({ page }) => {
  await signIn(page, SEED_ACCOUNTS.rejected);

  await expect(page).toHaveURL(/\/verification-status/);
  await expect(page.getByText("We could not verify your details")).toBeVisible();
  await expect(page.getByLabel("SSC roll number")).toBeVisible();
});

test("a verified user reaches the directory and can search", async ({ page }) => {
  await signIn(page, SEED_ACCOUNTS.verified);

  await page.goto("/directory");
  await expect(page.getByRole("heading", { name: "Alumni directory" })).toBeVisible();

  await page.getByLabel("Search alumni").fill("Rahman");
  await expect(page).toHaveURL(/q=Rahman/, { timeout: 5000 });
});

test("an anonymous visitor is redirected away from the directory", async ({ page }) => {
  await page.goto("/directory");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdirectory/);
});

test("an anonymous visitor cannot reach the admin area", async ({ page }) => {
  await page.goto("/admin/verifications");
  await expect(page).toHaveURL(/\/login/);
});

test("a verified non-staff user cannot reach the admin area", async ({ page }) => {
  await signIn(page, SEED_ACCOUNTS.verified);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/directory/);
});
