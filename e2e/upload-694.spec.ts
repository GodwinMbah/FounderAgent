import { test, expect, Page } from "@playwright/test";
import { existsSync } from "fs";
import { resolve } from "path";

const filePath = resolve(process.cwd(), "test_data/csv/revolut_694.csv");
const url = process.env.BASE_URL || "http://localhost:3000";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe.configure({ timeout: 300000 });

test.describe("694-row Revolut import", () => {
  test.skip(!existsSync(filePath), "revolut_694.csv not found");

  async function uploadAndReachPreview(page: Page) {
    await page.goto(`${url}/upload-centre`);

    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 20000 });
    await input.setInputFiles(filePath);

    // For 694 rows, processing may take up to 90 seconds
    // Wait for actual content (mapping or preview step), not just step indicator
    await page.waitForSelector('text=/Column Mapping|Rows Detected|Preview Import/', { timeout: 90000 });

    // If on mapping step, scroll to and click Preview Import
    const previewBtn = page.locator('button:has-text("Preview Import")');
    const count = await previewBtn.count();
    if (count > 0) {
      await previewBtn.scrollIntoViewIfNeeded();
      await previewBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    // Wait for preview table to appear (may take time for 694 rows)
    await page.waitForSelector('table tbody tr', { timeout: 60000 });
  }

  test("uploads 694 rows and imports successfully without session expired", async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await uploadAndReachPreview(page);

    // Verify preview loaded with many rows
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(50);

    // Verify no "Session expired" error on preview
    await expect(page.locator('text=Session expired')).not.toBeVisible();

    // Verify smart suggestions appear
    const pageText = await page.locator('body').textContent() || "";
    expect(pageText).toContain("suggestion");

    // Click Confirm and Import
    const confirmBtn = page.locator('button:has-text("Confirm")').first();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Wait for processing to complete (up to 3 minutes for 694 rows)
    await page.waitForTimeout(30000);

    // CRITICAL: Verify no "Session expired" error during import
    const bodyText = await page.locator('body').textContent() || "";
    expect(bodyText).not.toContain("Session expired");

    // Check if we're on summary step (success) or back on preview with error
    const isSummary = /Import Complete|Successfully imported|Rows Imported|Upload Another/i.test(bodyText);
    const isProcessing = await page.locator('text=/Importing|Processing/i').isVisible().catch(() => false);

    if (!isSummary && !isProcessing) {
      // If not summary and not processing, check for error
      const errorTitle = await page.locator('text=/Import failed|Could not import|Error/i').count();
      if (errorTitle > 0) {
        // Try to get specific error message
        const errorMsg = await page.locator('[class*="error"], [class*="toast"], [role="alert"]').textContent().catch(() => "Unknown error");
        console.log("Console logs:", consoleLogs.slice(-20).join("\n"));
        throw new Error(`Import failed with message: ${errorMsg}. Console: ${consoleLogs.slice(-10).join("; ")}`);
      }
    }

    // If still processing, poll for completion
    const maxWait = 180; // seconds
    for (let i = 0; i < maxWait; i++) {
      const text = await page.locator('body').textContent() || "";
      if (/Import Complete|Successfully imported|Rows Imported|Upload Another/i.test(text)) {
        break;
      }
      if (text.includes("Session expired")) {
        console.log("Console logs at failure:", consoleLogs.slice(-20).join("\n"));
        throw new Error("Session expired appeared during import");
      }
      if (await page.locator('text=/Import failed|Could not import/i').count() > 0) {
        const errorMsg = await page.locator('[class*="error"], [class*="toast"], [role="alert"]').textContent().catch(() => "Unknown error");
        console.log("Console logs at failure:", consoleLogs.slice(-20).join("\n"));
        throw new Error(`Import failed during polling: ${errorMsg}`);
      }
      await page.waitForTimeout(1000);
    }
  });

  test("categorises specific merchants correctly in preview", async ({ page }) => {
    await uploadAndReachPreview(page);

    const pageText = await page.locator('body').textContent() || "";

    // Verify specific merchants appear in preview (not left as Unknown)
    expect(pageText).toContain("Eventsconnecter");
    expect(pageText).toContain("Marketing Commission");
    expect(pageText).toContain("Highlevel");
    expect(pageText).toContain("Apple.com");
    expect(pageText).toContain("Stripe");

    // Verify no "Session expired" on preview
    expect(pageText).not.toContain("Session expired");
  });
});
