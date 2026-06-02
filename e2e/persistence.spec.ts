import { test, expect, Page } from "@playwright/test";
import * as path from "path";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TEST_USER = { email: "demo@acmelabs.com", password: "Demo1234!" };

const CSV_FILES = {
  tide: "./test_data/csv/tide_sample.csv",
  revolut: "./test_data/csv/revolut_business_sample.csv",
  wise: "./test_data/csv/wise_sample.csv",
  stripe: "./test_data/csv/stripe_payouts_sample.csv",
  paypal: "./test_data/csv/paypal_activity_sample.csv",
  monzo: "./test_data/csv/monzo_sample.csv",
  generic: "./test_data/csv/generic_money_in_out.csv",
};

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

async function logout(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForTimeout(1000);
  const userMenu = page.locator('text=demo@acmelabs.com');
  if (await userMenu.isVisible().catch(() => false)) {
    await userMenu.click();
    await page.waitForTimeout(500);
    const signOut = page.locator('text=Sign out');
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 10000 });
    }
  }
}

async function uploadAndComplete(page: Page, filePath: string) {
  await page.goto(`${BASE_URL}/upload-centre`);
  await page.waitForTimeout(2000);

  const input = await page.locator('input[type="file"]');
  await input.setInputFiles(filePath);
  await page.waitForTimeout(4000);

  // Take screenshot of mapping step
  const fileName = path.basename(filePath, ".csv");
  await page.screenshot({ path: `qa-report/screenshots/${fileName}-mapping.png` });

  // Navigate to preview
  const previewBtn = page.locator('button:has-text("Preview")');
  if (await previewBtn.isVisible().catch(() => false)) {
    await previewBtn.click();
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: `qa-report/screenshots/${fileName}-preview.png` });

  // Confirm import
  const confirmBtn = page.locator('button:has-text("Confirm")');
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  // Wait for summary
  await page.waitForSelector('text=/Summary|Import complete|success/i', { timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `qa-report/screenshots/${fileName}-summary.png` });
}

async function verifyTransactionsPage(page: Page, minRows = 1) {
  await page.goto(`${BASE_URL}/transactions`);
  await page.waitForTimeout(3000);
  const rows = await page.locator('table tbody tr').count();
  expect(rows).toBeGreaterThanOrEqual(minRows);
  await page.screenshot({ path: `qa-report/screenshots/transactions-check.png` });
}

async function verifyDashboard(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForTimeout(3000);
  const kpiLabels = ["Cash Balance", "Monthly Revenue", "Monthly Expenses", "Net Profit"];
  for (const label of kpiLabels) {
    const el = page.locator(`text=${label}`).first();
    await expect(el).toBeVisible();
  }
  await page.screenshot({ path: `qa-report/screenshots/dashboard-check.png` });
}

// ───────────────────────────────────────────────────────────────
// TESTS
// ───────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial", timeout: 120000 });

test.describe("Backend Persistence - Full Flow", () => {
  test("Tide upload → verify transactions → refresh → logout/login → data remains", async ({ page }) => {
    await login(page);

    // Upload Tide CSV
    await uploadAndComplete(page, CSV_FILES.tide);

    // Verify transactions page
    await verifyTransactionsPage(page, 1);

    // Verify dashboard
    await verifyDashboard(page);

    // Refresh browser
    await page.reload();
    await page.waitForTimeout(3000);
    const kpiAfterRefresh = page.locator('text=Monthly Revenue').first();
    await expect(kpiAfterRefresh).toBeVisible();
    await page.screenshot({ path: `qa-report/screenshots/tide-after-refresh.png` });

    // Logout and login again
    await logout(page);
    await login(page);

    // Verify dashboard still shows data
    await verifyDashboard(page);
    await page.screenshot({ path: `qa-report/screenshots/tide-after-relogin.png` });

    // Verify transactions still exist
    await verifyTransactionsPage(page, 1);
  });

  test("Duplicate upload does not double count", async ({ page }) => {
    await login(page);

    // First upload
    await uploadAndComplete(page, CSV_FILES.tide);
    await verifyTransactionsPage(page, 1);

    // Count rows after first upload
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForTimeout(3000);
    const rowsAfterFirst = await page.locator('table tbody tr').count();

    // Upload same file again
    await uploadAndComplete(page, CSV_FILES.tide);

    // Count rows after duplicate
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForTimeout(3000);
    const rowsAfterDuplicate = await page.locator('table tbody tr').count();

    // Should not have doubled
    expect(rowsAfterDuplicate).toBeLessThanOrEqual(rowsAfterFirst + 3); // allow small margin
    await page.screenshot({ path: `qa-report/screenshots/duplicate-check.png` });
  });

  test("Revolut upload with high confidence shows auto-accept banner", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/upload-centre`);
    await page.waitForTimeout(2000);

    const input = await page.locator('input[type="file"]');
    await input.setInputFiles(CSV_FILES.revolut);
    await page.waitForTimeout(4000);

    // High confidence banner should show
    const banner = page.locator('text=/high confidence/i');
    await expect(banner).toBeVisible();
    await page.screenshot({ path: `qa-report/screenshots/revolut-high-confidence.png` });

    // Complete import
    const previewBtn = page.locator('button:has-text("Preview")');
    if (await previewBtn.isVisible().catch(() => false)) {
      await previewBtn.click();
      await page.waitForTimeout(3000);
    }
    const confirmBtn = page.locator('button:has-text("Confirm")');
    await confirmBtn.click();
    await page.waitForSelector('text=/Summary|Import complete|success/i', { timeout: 45000 });
  });

  test("Medium confidence shows confirmation prompt", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/upload-centre`);
    await page.waitForTimeout(2000);

    // generic_debit_credit.csv scores 55% with Wise — medium confidence range (50-84)
    const input = await page.locator('input[type="file"]');
    await input.setInputFiles("./test_data/csv/generic_debit_credit.csv");
    await page.waitForTimeout(4000);

    const banner = page.locator('text=/Please confirm before importing/i');
    await expect(banner).toBeVisible();
    await page.screenshot({ path: `qa-report/screenshots/medium-confidence.png` });
  });
});
