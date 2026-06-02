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

async function goToUploadCentre(page: Page) {
  await page.goto(`${BASE_URL}/upload-centre`);
  await page.waitForSelector('text=/Upload Centre|Upload/i', { timeout: 10000 });
}

async function uploadFile(page: Page, filePath: string) {
  const input = await page.locator('input[type="file"]');
  await input.setInputFiles(filePath);
  await page.waitForTimeout(3000);
}

// ───────────────────────────────────────────────────────────────
// CONFIDENCE TIER TESTS
// ───────────────────────────────────────────────────────────────

test.describe("Confidence Tiers", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("High confidence auto-accepts", async ({ page }) => {
    await uploadFile(page, "./test_data/csv/tide_sample.csv");

    // Green banner should show
    const greenBanner = page.locator('div[class*="border-emerald"]').first();
    await expect(greenBanner).toBeVisible();

    const bannerText = await greenBanner.textContent().catch(() => "");
    expect(bannerText.toLowerCase()).toContain("high confidence");

    // Confirm Provider button should NOT exist
    const confirmBtn = page.locator('button:has-text("Confirm Provider")');
    expect(await confirmBtn.isVisible().catch(() => false)).toBe(false);

    // Preview Import should be enabled
    const previewBtn = page.locator('button:has-text("Preview Import")');
    await expect(previewBtn).toBeVisible();
    expect(await previewBtn.isEnabled()).toBe(true);

    await page.screenshot({ path: "e2e/screenshots/high-confidence-tier.png" });
  });

  test("Medium confidence requires confirmation", async ({ page }) => {
    await uploadFile(page, "./test_data/csv/generic_debit_credit.csv");

    // Amber banner should show
    const amberBanner = page.locator('div[class*="border-amber"]').first();
    await expect(amberBanner).toBeVisible();

    const bannerText = await amberBanner.textContent().catch(() => "");
    expect(bannerText.toLowerCase()).toContain("please confirm before importing");

    // Confirm Provider button should be visible
    const confirmBtn = page.locator('button:has-text("Confirm Provider")');
    await expect(confirmBtn).toBeVisible();

    // Preview Import should be disabled until confirmed
    const previewBtn = page.locator('button:has-text("Preview Import")');
    await expect(previewBtn).toBeVisible();
    expect(await previewBtn.isEnabled()).toBe(false);

    // Confirm provider
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Preview Import should now be enabled
    expect(await previewBtn.isEnabled()).toBe(true);

    // Provider confirmed note should appear
    const confirmedNote = page.locator('text=/Provider confirmed/i');
    await expect(confirmedNote).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/medium-confidence-tier.png" });
  });

  test("Low confidence generic fallback", async ({ page }) => {
    await uploadFile(page, "./test_data/csv/low_confidence_en.csv");

    // Red banner should show
    const redBanner = page.locator('div[class*="border-rose"]').first();
    await expect(redBanner).toBeVisible();

    const bannerText = await redBanner.textContent().catch(() => "");
    expect(bannerText.toLowerCase()).toContain("generic bank csv");

    // Provider override dropdown should still be available
    const bannerSelect = redBanner.locator('select');
    await expect(bannerSelect).toBeVisible();

    // Preview Import should be enabled because low confidence falls back to generic
    const previewBtn = page.locator('button:has-text("Preview Import")');
    await expect(previewBtn).toBeVisible();
    expect(await previewBtn.isEnabled()).toBe(true);

    await page.screenshot({ path: "e2e/screenshots/low-confidence-tier.png" });
  });
});
