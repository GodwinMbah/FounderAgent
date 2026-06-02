import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { resolve } from "path";

const filePath = resolve(process.cwd(), "test_data/csv/revolut_694.csv");
const url = process.env.BASE_URL || "http://localhost:3000";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe.configure({ timeout: 300000 });

test("debug import flow", async ({ page }) => {
  test.skip(!existsSync(filePath), "revolut_694.csv not found");

  await page.goto(`${url}/upload-centre`);

  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached", timeout: 20000 });
  await input.setInputFiles(filePath);

  // Wait for actual content to load
  await page.waitForSelector('text=/Column Mapping|Rows Detected|Preview Import/', { timeout: 90000 });

  // If on mapping step, click Preview Import
  const previewBtn = page.locator('button:has-text("Preview Import")');
  if (await previewBtn.count() > 0) {
    await previewBtn.scrollIntoViewIfNeeded();
    await previewBtn.click({ force: true });
  }

  // Wait for preview table
  await page.waitForSelector('table tbody tr', { timeout: 60000 });

  // Click Confirm & Import
  const confirmBtn = page.locator('button:has-text("Confirm")').first();
  await confirmBtn.click();

  // Poll for up to 3 minutes
  for (let i = 0; i < 180; i++) {
    const text = await page.locator('body').textContent() || "";

    // Only match summary step content, not the step indicator label
    if (/Import Complete|Successfully imported|Rows Imported|Upload Another/i.test(text)) {
      console.log("Import succeeded after", i, "seconds");
      await page.screenshot({ path: 'test-results/debug-import-success.png' });
      return;
    }

    if (text.includes("Session expired")) {
      throw new Error("Session expired during import");
    }

    // Check for visible error banner (not just any text containing "error")
    const errorBanner = page.locator('[class*="bg-red"], [class*="bg-rose"], [class*="border-red"], [class*="border-rose"]').filter({ hasText: /Import failed|Could not import|Session expired/i });
    if (await errorBanner.count() > 0) {
      const errorText = await errorBanner.textContent();
      throw new Error(`Import failed: ${errorText}`);
    }

    await page.waitForTimeout(1000);
  }

  throw new Error("Import did not complete within 3 minutes");
});
