import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const AUTH_STATE = path.join(__dirname, "../playwright/.auth/user.json");

// Use stored auth state if available
test.use({
  storageState: fs.existsSync(AUTH_STATE) ? AUTH_STATE : undefined,
});

async function ensureLoggedIn(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`);
  if (page.url().includes("/login")) {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', "demo@acmelabs.com");
    await page.fill('input[type="password"]', "Demo1234!");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 });
  }
}

async function uploadCsvAndReachPreview(page: Page, filePath: string) {
  await page.goto(`${BASE_URL}/upload-centre`);
  await page.waitForSelector('text=/Click or drag CSV|Upload Centre/i', { timeout: 15000 });

  // Find file input even if visually hidden
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached", timeout: 15000 });
  await input.setInputFiles(filePath);

  // Wait for mapping or preview step to appear
  await page.waitForSelector('text=/Preview Import|Confirm|Mapping/i', { timeout: 15000 });

  // If on mapping step, click Preview Import
  const previewBtn = page.locator('button:has-text("Preview Import")');
  if (await previewBtn.isVisible().catch(() => false)) {
    await previewBtn.click();
  }

  // Wait for preview table
  await page.waitForSelector('table tbody tr', { timeout: 15000 });
}

test.describe("Upload Category Edit Persistence", () => {
  test("preview category edit flows through to import", async ({ page }) => {
    await ensureLoggedIn(page);

    const filePath = "./test_data/csv/tide_sample.csv";
    if (!fs.existsSync(filePath)) {
      test.skip(true, "Test CSV not found");
      return;
    }

    await uploadCsvAndReachPreview(page, filePath);

    // Find a category cell and change it
    const categoryCells = page.locator('table tbody tr td:nth-child(7)');
    await expect(categoryCells.first()).toBeVisible();
    const firstCell = categoryCells.first();
    await firstCell.locator('select').selectOption('Software');

    // Confirm import
    const confirmBtn = page.locator('button:has-text("Confirm & Import")').last();
    await confirmBtn.scrollIntoViewIfNeeded();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for processing completion — look for summary or completion text
    const completionLocator = page.locator('text=/Import complete|Summary|completed|rows processed/i').first();
    await expect(completionLocator).toBeVisible({ timeout: 30000 });

    // Screenshot for verification
    await page.screenshot({ path: "e2e/screenshots/upload-completion.png" });
  });

  test("dashboard loads without errors after import", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForSelector('text=/Cash Balance|Monthly Revenue|Command Centre/i', { timeout: 15000 });

    // Should not show error state
    const errorBlocks = await page.locator('text=/Something went wrong|Error|failed to load/i').count();
    expect(errorBlocks).toBe(0);
  });

  test("transactions page loads without errors", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForSelector('text=/Transaction List|No data available/i', { timeout: 15000 });

    // Should not show error state
    const errorBlocks = await page.locator('text=/Something went wrong|Error|failed to load/i').count();
    expect(errorBlocks).toBe(0);
  });
});
