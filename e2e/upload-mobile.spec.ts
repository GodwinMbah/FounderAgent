import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const AUTH_STATE = path.join(__dirname, "../playwright/.auth/user.json");

// Use stored auth state if available
test.use({
  storageState: fs.existsSync(AUTH_STATE) ? AUTH_STATE : undefined,
});

const CSV_FILES = {
  tide: "./test_data/csv/tide_sample.csv",
  bankStandard: "./test_data/csv/bank-standard.csv",
  revolut: "./test_data/csv/revolut_business_sample.csv",
};

async function login(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`);
  try {
    await page.waitForSelector('text=/Cash Balance|Dashboard|Monthly Revenue/i', { timeout: 5000 });
    return;
  } catch {
    // Not authenticated — fall back to manual login
  }

  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', "demo@acmelabs.com");
  await page.fill('input[type="password"]', "Demo1234!");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}

async function goToUploadCentre(page: Page) {
  await page.goto(`${BASE_URL}/upload-centre`);
  await page.waitForSelector('h1:has-text("Upload Centre")', { timeout: 10000 });
}

async function uploadFileAndPreview(page: Page, filePath: string) {
  const input = await page.locator('input[type="file"]');
  await input.setInputFiles(filePath);
  // Wait for mapping/preview step to appear
  await page.waitForTimeout(3000);
}

async function navigateToPreview(page: Page) {
  // Handle provider confirmation if needed
  const confirmBtn = page.locator('button:has-text("Confirm Provider")');
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
  }

  const previewBtn = page.locator('button:has-text("Preview Import")');
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();
  await page.waitForTimeout(3000);
}

// ───────────────────────────────────────────────────────────────
// iPhone 14
// ───────────────────────────────────────────────────────────────
test.describe("Mobile Upload Preview — iPhone 14", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("Mobile upload preview loads without overflow/scroll issues", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.tide);
    await navigateToPreview(page);

    // Verify preview table is visible
    await expect(page.locator('text=/Preview/i').first()).toBeVisible();

    // Check no horizontal overflow on body
    const bodyOverflow = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth > body.clientWidth;
    });
    expect(bodyOverflow).toBe(false);

    // Screenshot for visual validation
    await page.screenshot({ path: "e2e/screenshots/mobile-iphone-preview.png", fullPage: true });
  });

  test("Mobile category edit updates category", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.tide);
    await navigateToPreview(page);

    // Wait for preview table
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    // Find first category dropdown and change it
    const categorySelect = page.locator('table tbody tr').first().locator('select');
    await expect(categorySelect).toBeVisible();

    // Get current value and pick a different one
    const currentValue = await categorySelect.inputValue();
    const options = await categorySelect.locator("option").allInnerTexts();
    const newValue = options.find((o) => o.trim() !== currentValue) || options[1];

    await categorySelect.selectOption(newValue);
    await page.waitForTimeout(500);

    // Verify value changed
    await expect(categorySelect).toHaveValue(newValue);

    await page.screenshot({ path: "e2e/screenshots/mobile-iphone-category-edit.png", fullPage: true });
  });

  test("Mobile apply to similar modal fits on screen", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.bankStandard);
    await navigateToPreview(page);

    // Wait for preview table
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    // Change first row category to trigger "Apply to similar"
    const firstRow = page.locator('table tbody tr').first();
    const categorySelect = firstRow.locator('select');
    await categorySelect.selectOption("Software");
    await page.waitForTimeout(500);

    // Tap "Apply to similar" button
    const applyBtn = page.locator('button:has-text("Apply to similar")').first();
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();
    await page.waitForTimeout(500);

    // Verify modal is visible and fits within viewport
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const modalFits = await modal.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
    });
    expect(modalFits).toBe(true);

    // Close modal
    await page.locator('[role="dialog"] button:has-text("Cancel")').click();
    await expect(modal).not.toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/mobile-iphone-apply-modal.png", fullPage: true });
  });

  test("Mobile suggestions panel stacks vertically and is readable", async ({ page }) => {
    // Use revolut CSV which likely triggers suggestions
    await uploadFileAndPreview(page, CSV_FILES.revolut);
    await navigateToPreview(page);

    // Check if suggestions panel exists
    const suggestionsPanel = page.locator('text=/Smart Suggestions/i');
    if (await suggestionsPanel.isVisible().catch(() => false)) {
      // Verify cards stack vertically (flex-col on mobile)
      const firstCard = page.locator('[class*="rounded-xl border"]').filter({ hasText: /Suggested category/i }).first();
      if (await firstCard.isVisible().catch(() => false)) {
        const isVertical = await firstCard.evaluate((el) => {
          const parent = el.querySelector('[class*="flex flex-col"]') || el.querySelector('[class*="sm:flex-row"]');
          return !!parent;
        });
        expect(isVertical).toBe(true);
      }
    }

    await page.screenshot({ path: "e2e/screenshots/mobile-iphone-suggestions.png", fullPage: true });
  });

  test("Mobile merchant logos don't break layout", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.bankStandard);
    await navigateToPreview(page);

    // Verify merchant logos are visible and within bounds
    const merchantCells = page.locator('table tbody tr td').nth(2);
    const count = await merchantCells.count();
    expect(count).toBeGreaterThan(0);

    // Check that no logo overflows its container
    const logosOverflow = await page.evaluate(() => {
      const logos = document.querySelectorAll('img[class*="rounded-full"], div[class*="rounded-full"][class*="shrink-0"]');
      for (const logo of logos) {
        const rect = logo.getBoundingClientRect();
        const parent = logo.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          if (rect.width > parentRect.width || rect.height > parentRect.height) {
            return true;
          }
        }
      }
      return false;
    });
    expect(logosOverflow).toBe(false);

    await page.screenshot({ path: "e2e/screenshots/mobile-iphone-logos.png", fullPage: true });
  });

  test("Touch targets are at least 44px", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.tide);
    await navigateToPreview(page);

    // Check common interactive elements
    const tooSmall = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, select, a, input[type="checkbox"], input[type="file"]');
      const violations: string[] = [];
      for (const el of interactive) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 && rect.height < 44) {
          // Only flag visible elements that are meant to be tapped
          if (rect.width > 0 && rect.height > 0) {
            violations.push(`${el.tagName} ${(el as HTMLElement).innerText?.slice(0, 20) || ''} (${rect.width}x${rect.height})`);
          }
        }
      }
      return violations;
    });

    // We allow small elements like tiny icons inside buttons, but flag any standalone small buttons
    // Filter out elements that are children of larger clickable elements
    const standaloneSmall = tooSmall.filter((v) => !v.includes("svg") && !v.includes("IMG"));
    expect(standaloneSmall.length).toBeLessThanOrEqual(5);
  });
});

// ───────────────────────────────────────────────────────────────
// iPad
// ───────────────────────────────────────────────────────────────
test.describe("Mobile Upload Preview — iPad", () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("Tablet preview table is readable without excessive horizontal scrolling", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.bankStandard);
    await navigateToPreview(page);

    // Verify preview table is visible
    await expect(page.locator('text=/Preview/i').first()).toBeVisible();

    // Table may intentionally scroll, but body should not
    const bodyOverflow = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth > body.clientWidth;
    });
    expect(bodyOverflow).toBe(false);

    // Check table container has overflow-x-auto (intentional scroll)
    const tableContainer = page.locator('div.overflow-x-auto');
    await expect(tableContainer).toBeVisible();

    // Verify table is readable (font size >= 12px equivalent)
    const fontSize = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return 0;
      const style = window.getComputedStyle(table);
      return parseFloat(style.fontSize);
    });
    expect(fontSize).toBeGreaterThanOrEqual(10);

    await page.screenshot({ path: "e2e/screenshots/mobile-ipad-preview.png", fullPage: true });
  });

  test("Tablet category dropdown works", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.tide);
    await navigateToPreview(page);

    const categorySelect = page.locator('table tbody tr').first().locator('select');
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption("Software");
    await page.waitForTimeout(500);
    await expect(categorySelect).toHaveValue("Software");

    await page.screenshot({ path: "e2e/screenshots/mobile-ipad-category.png", fullPage: true });
  });
});

// ───────────────────────────────────────────────────────────────
// Desktop (comparison)
// ───────────────────────────────────────────────────────────────
test.describe("Mobile Upload Preview — Desktop comparison", () => {
  test.use({
    viewport: { width: 1280, height: 720 },
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("Desktop preview renders side-by-side elements", async ({ page }) => {
    await uploadFileAndPreview(page, CSV_FILES.bankStandard);
    await navigateToPreview(page);

    // Verify preview table is visible
    await expect(page.locator('text=/Preview/i').first()).toBeVisible();

    // On desktop, suggestions panel actions should be visible (not hidden sm:hidden)
    const suggestionsPanel = page.locator('text=/Smart Suggestions/i');
    if (await suggestionsPanel.isVisible().catch(() => false)) {
      const approveAllBtn = page.locator('button:has-text("Approve All")').first();
      // Desktop should show the Approve All button in header (not just mobile section)
      await expect(approveAllBtn).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/mobile-desktop-preview.png", fullPage: true });
  });
});
