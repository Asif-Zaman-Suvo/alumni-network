import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, SEED_PASSWORD, signIn } from "./helpers";

test("admin can open the verification queue and approve a pending request", async ({
  page,
}) => {
  await signIn(page, ADMIN_EMAIL, SEED_PASSWORD);

  await page.goto("/admin/verifications");
  await expect(page.getByRole("heading", { name: /verification/i })).toBeVisible();

  // Oldest-first queue: the first actionable row is the one we decide on.
  const approveButton = page.getByRole("button", { name: /^Approve$/ }).first();
  if (await approveButton.isVisible().catch(() => false)) {
    await approveButton.click();
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });
  } else {
    // Queue may already be empty after a previous run; the page itself must still render.
    await expect(page.getByText(/no pending|queue is clear|0 pending/i)).toBeVisible();
  }
});

test("admin users page lists alumni", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, SEED_PASSWORD);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();
  await expect(page.getByText("alumni0@example.test")).toBeVisible();
});
