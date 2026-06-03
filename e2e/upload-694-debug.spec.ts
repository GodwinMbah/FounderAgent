import { test } from "@playwright/test";
import { existsSync } from "fs";
import { resolve } from "path";

const filePath = resolve(process.cwd(), "test_data/csv/revolut_694.csv");
const url = process.env.BASE_URL || "http://localhost:3000";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe.configure({ timeout: 300000 });

test("debug upload flow", async ({ page }) => {
  test.skip(!existsSync(filePath), "revolut_694.csv not found");

  await page.goto(`${url}/upload-centre`);
  await page.waitForSelector('text=/Click or drag CSV|Upload Centre/i', { timeout: 20000 });

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath);

  // Wait for actual content to load (either mapping or preview step content)
  await page.waitForSelector('text=/Column Mapping|Rows Detected|Preview Import/', { timeout: 90000 });

  // Take screenshot of current state
  await page.screenshot({ path: 'test-results/debug-01-after-upload.png' });

  // Check current step - look for specific elements
  const hasColumnMapping = await page.locator('text=Column Mapping').count() > 0;
  const hasPreviewTable = await page.locator('table tbody tr').count() > 0;
  const hasStatsCards = await page.locator('text=Rows Detected').count() > 0;
  console.log("Step after upload - Column Mapping:", hasColumnMapping, "Preview table:", hasPreviewTable, "Stats cards:", hasStatsCards);

  // Find and click Preview Import
  const previewBtn = page.locator('button:has-text("Preview Import")');
  const btnCount = await previewBtn.count();
  console.log("Preview Import button count:", btnCount);

  if (btnCount > 0) {
    const isVisible = await previewBtn.isVisible().catch(() => false);
    const isEnabled = await previewBtn.isEnabled().catch(() => false);
    console.log("Button visible:", isVisible, "enabled:", isEnabled);

    await previewBtn.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/debug-02-before-click.png' });
    await previewBtn.click({ force: true });
    console.log("Clicked Preview Import");

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/debug-03-after-click.png' });

    // Check if step changed
    const hasColumnMappingAfter = await page.locator('text=Column Mapping').count() > 0;
    const hasStatsCardsAfter = await page.locator('text=Rows Detected').count() > 0;
    console.log("Step after click - Column Mapping:", hasColumnMappingAfter, "Stats cards:", hasStatsCardsAfter);
  }

  // Wait for preview table
  try {
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    console.log("Preview table found!");
    await page.screenshot({ path: 'test-results/debug-04-preview-loaded.png' });
  } catch {
    console.log("Preview table NOT found within 30s");
    await page.screenshot({ path: 'test-results/debug-04-no-preview.png' });
  }
});
