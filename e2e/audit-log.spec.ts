import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, SEED_ACCOUNTS, SEED_PASSWORD, signIn } from "./helpers";

/**
 * Coverage for the audit trail and its access boundaries.
 *
 * The live Realtime path is not asserted here: it needs an ES256 signing key registered in the
 * Supabase project, which CI does not have. The dashboard is built to degrade to the API in that
 * case, and that degraded path is what these tests exercise — so a missing key shows up as a
 * connection badge, never as missing history.
 */

test.describe("audit log", () => {
  /** Scoped to table cells because the filter dropdown carries the same labels in its options. */
  const eventCell = (page: Page, label: string) => page.getByRole("cell", { name: label });

  test("records a successful sign-in and shows it to an administrator", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, SEED_PASSWORD);

    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();

    // The sign-in that just happened must be on the first page, since rows are newest-first.
    await expect(eventCell(page, "Signed in").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(ADMIN_EMAIL).first()).toBeVisible();
  });

  test("records a failed sign-in without revealing whether the account exists", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SEED_ACCOUNTS.verified);
    await page.getByLabel("Password", { exact: true }).fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Identical copy for a wrong password and an unknown address. Surfaced both inline and as a
    // toast, so the first match is enough to prove the generic message was chosen.
    await expect(page.getByText(/email or password is incorrect/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await signIn(page, ADMIN_EMAIL, SEED_PASSWORD);
    await page.goto("/admin/audit");

    const failedFilter = page.getByLabel("Event");
    await failedFilter.selectOption("LOGIN_FAILED");

    await expect(eventCell(page, "Sign-in failed").first()).toBeVisible({ timeout: 30_000 });
    // The address is stored only as an HMAC, so it must not appear anywhere in the rendered log.
    await expect(page.getByText(SEED_ACCOUNTS.verified)).toHaveCount(0);
  });

  test("filters between authentication events and admin actions", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, SEED_PASSWORD);
    await page.goto("/admin/audit");

    await page.getByLabel("Category").selectOption("auth");
    await expect(eventCell(page, "Signed in").first()).toBeVisible({ timeout: 30_000 });

    await page.getByLabel("Category").selectOption("staff");
    // Staff rows are dotted lowercase action names, never the authentication labels.
    await expect(eventCell(page, "Signed in")).toHaveCount(0);
  });

  test("hides the audit history and the realtime token from a non-administrator", async ({
    page,
  }) => {
    await signIn(page, SEED_ACCOUNTS.verified, SEED_PASSWORD);

    await page.goto("/admin/audit");
    // The proxy redirects, but the API is the boundary that actually matters.
    await expect(page).not.toHaveURL(/\/admin\/audit/);

    const history = await page.request.get("/api/admin/audit-logs");
    expect(history.status()).toBe(404);

    const token = await page.request.post("/api/admin/realtime-token");
    expect(token.status()).toBe(404);
  });

  test("rejects an unauthenticated request for the audit history", async ({ request }) => {
    const response = await request.get("/api/admin/audit-logs");
    expect(response.status()).toBe(404);
  });

  test("rejects the expiry cron without the shared secret", async ({ request }) => {
    const response = await request.get("/api/cron/expire-sessions");
    expect([404, 503]).toContain(response.status());
  });

  test("signing out ends the session, and the cookie stops working", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, SEED_PASSWORD);

    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL((url) => url.pathname === "/");

    // The AuthSession row is now LOGGED_OUT, so the DAL must refuse the cookie even though it is
    // still cryptographically valid — this is the revocation guarantee the table exists for.
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/login/);
  });
});
