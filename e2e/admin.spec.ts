import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, SEED_PASSWORD, signIn } from "./helpers";

test("admin can open the verification queue and approve a pending request", async ({
  page,
}) => {
  await signIn(page, ADMIN_EMAIL, SEED_PASSWORD);

  await page.goto("/admin/verifications");
  // Every admin route shares the "Administration" heading from the layout, so the review queue is
  // identified by its own tab strip rather than by a heading of its own.
  await expect(page.getByRole("link", { name: "Review queue" })).toBeVisible();

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
  await expect(page.getByText(/\d+ users · page \d+ of \d+/)).toBeVisible();

  // Hundreds of seeded alumni span many pages, so the account is reached by searching rather than
  // by assuming it landed on the first one.
  await page.getByPlaceholder("Search name or email").fill("alumni0@example.test");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("alumni0@example.test")).toBeVisible();
});
