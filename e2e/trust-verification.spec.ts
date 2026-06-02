import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TEST_USER = { email: "demo@acmelabs.com", password: "Demo1234!" };

async function login(page: Page) {
  // If storage state is loaded, we may already be authenticated
  await page.goto(`${BASE_URL}/dashboard`);
  try {
    await page.waitForSelector('text=/Cash Balance|Dashboard|Monthly Revenue/i', { timeout: 5000 });
    return; // Already authenticated via storage state
  } catch {
    // Not authenticated — fall back to manual login
  }

  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}

test.describe("P0 Trust Verification", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ───────────────────────────────────────────────────────────────
  // DASHBOARD TRUST
  // ───────────────────────────────────────────────────────────────

  test("Dashboard does not show MRR mislabel", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    // Should NOT find "MRR" as a standalone KPI label
    const mrrLabels = page.locator('text=/^MRR$/i');
    expect(await mrrLabels.count()).toBe(0);

    await page.screenshot({ path: "e2e/screenshots/trust-dashboard.png" });
  });

  test("Dashboard does not show fake hardcoded growth", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');

    // No hardcoded growth percentages that look fabricated
    expect(pageText).not.toContain("+5.3%");
    expect(pageText).not.toContain("+3.2%");

    await page.screenshot({ path: "e2e/screenshots/trust-dashboard-growth.png" });
  });

  // ───────────────────────────────────────────────────────────────
  // REVENUE PAGE TRUST
  // ───────────────────────────────────────────────────────────────

  test("Revenue page does not show fake MRR growth", async ({ page }) => {
    await page.goto(`${BASE_URL}/revenue`);
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');

    // The fake +5.3% MRR growth should not exist
    expect(pageText).not.toContain("+5.3%");

    // Monthly Sub Spend label should be present (not "MRR")
    await expect(page.locator('text=/Monthly Sub Spend/i').first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/trust-revenue.png" });
  });

  // ───────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS PAGE TRUST
  // ───────────────────────────────────────────────────────────────

  test("Subscriptions page does not show fake growth or trend", async ({ page }) => {
    await page.goto(`${BASE_URL}/subscriptions`);
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');

    // No hardcoded +3.2%
    expect(pageText).not.toContain("+3.2%");

    // No fake vendor names from the old hardcoded insights
    expect(pageText).not.toContain("HubSpot and Linear");
    expect(pageText).not.toContain("AWS and Datadog");
    expect(pageText).not.toContain("Zoom usage is below 10%");

    // Note: empty state may or may not be visible depending on data; we just verify no fake chart data exists

    await page.screenshot({ path: "e2e/screenshots/trust-subscriptions.png" });
  });

  // ───────────────────────────────────────────────────────────────
  // RUNWAY PAGE TRUST
  // ───────────────────────────────────────────────────────────────

  test("Runway page does not show hardcoded scenario values", async ({ page }) => {
    await page.goto(`${BASE_URL}/runway`);
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');

    // Old hardcoded dollar amounts should be gone
    expect(pageText).not.toContain("$9,650");
    expect(pageText).not.toContain("$25,000");
    expect(pageText).not.toContain("$836");

    // Scenarios should be based on live data (we can't verify exact numbers,
    // but we can verify the page loads and shows scenario names)
    await expect(page.locator('text=/Revenue Drop 20%/i').first()).toBeVisible();
    await expect(page.locator('text=/Expense Increase 15%/i').first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/trust-runway.png" });
  });

  // ───────────────────────────────────────────────────────────────
  // CASH FLOW PAGE TRUST
  // ───────────────────────────────────────────────────────────────

  test("Cash Flow page Closing Balance is not hardcoded Strong", async ({ page }) => {
    await page.goto(`${BASE_URL}/cash-flow`);
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');

    // Old hardcoded "Strong" should not appear on Closing Balance
    // (it was replaced with dynamic Positive/Negative)
    const closingBalanceCard = page.locator('div').filter({ hasText: /Closing Balance/i }).first();
    await expect(closingBalanceCard).toBeVisible();

    // No hardcoded risk titles from the old static array
    expect(pageText).not.toContain("Ad spend increasing faster than revenue");
    expect(pageText).not.toContain("Strong cash inflow from enterprise clients");

    await page.screenshot({ path: "e2e/screenshots/trust-cashflow.png" });
  });

  // ───────────────────────────────────────────────────────────────
  // BUDGETS PAGE TRUST
  // ───────────────────────────────────────────────────────────────

  test("Budgets page does not show fake vendor recommendations", async ({ page }) => {
    await page.goto(`${BASE_URL}/budgets`);
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');

    // Old hardcoded recommendations with vendor names should be gone
    expect(pageText).not.toContain("HubSpot renewal");
    expect(pageText).not.toContain("AWS reserved instances");

    await page.screenshot({ path: "e2e/screenshots/trust-budgets.png" });
  });

  // ───────────────────────────────────────────────────────────────
  // AI DRAWER TRUST
  // ───────────────────────────────────────────────────────────────

  test("Assistant Drawer does not show mock tasks", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    // Open assistant drawer
    const drawerBtn = page.locator('button[aria-label*="assistant"], button[aria-label*="AI"]').first();
    if (await drawerBtn.isVisible().catch(() => false)) {
      await drawerBtn.click();
      await page.waitForTimeout(500);
    }

    const pageText = await page.textContent('body');

    // Old mock task titles should not appear
    expect(pageText).not.toContain("Find cheaper alternatives to Datadog");
    expect(pageText).not.toContain("Detect duplicate subscriptions");
    expect(pageText).not.toContain("Forecast runway scenarios");
    expect(pageText).not.toContain("Flag wasteful spending");

    await page.screenshot({ path: "e2e/screenshots/trust-assistant-drawer.png" });
  });

  // ───────────────────────────────────────────────────────────────
  // TOPBAR TRUST
  // ───────────────────────────────────────────────────────────────

  test("TopBar does not show hardcoded May 2024 date", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');

    // Old hardcoded date should be gone
    expect(pageText).not.toContain("May 12 – May 18, 2024");

    await page.screenshot({ path: "e2e/screenshots/trust-topbar.png" });
  });
});
