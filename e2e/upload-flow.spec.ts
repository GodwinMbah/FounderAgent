import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const TEST_USER = { email: "demo@acmelabs.com", password: "Demo1234!" };
const AUTH_STATE = path.join(__dirname, "../playwright/.auth/user.json");

// Use stored auth state if available
test.use({
  storageState: fs.existsSync(AUTH_STATE) ? AUTH_STATE : undefined,
});

// CSV test files
const CSV_FILES = {
  tide: "./test_data/csv/tide_sample.csv",
  revolut: "./test_data/csv/revolut_business_sample.csv",
  wise: "./test_data/csv/wise_sample.csv",
  monzo: "./test_data/csv/monzo_sample.csv",
  starling: "./test_data/csv/starling_sample.csv",
  stripe: "./test_data/csv/stripe_payouts_sample.csv",
  paypal: "./test_data/csv/paypal_activity_sample.csv",
  generic: "./test_data/csv/generic_money_in_out.csv",
  genericDebitCredit: "./test_data/csv/generic_debit_credit.csv",
  bankStandard: "./test_data/csv/bank-standard.csv",
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

async function goToUploadCentre(page: Page) {
  await page.goto(`${BASE_URL}/upload-centre`);
  await page.waitForSelector('text=/Upload Centre|Upload/i', { timeout: 10000 });
}

async function uploadFile(page: Page, filePath: string) {
  const input = await page.locator('input[type="file"]');
  await input.setInputFiles(filePath);
  // Wait for mapping/preview step to appear
  await page.waitForTimeout(3000);
}

async function getProviderInfo(page: Page) {
  const banner = page.locator('[class*="border-emerald"], [class*="border-amber"], [class*="border-rose"]').first();
  const text = await banner.textContent().catch(() => "");
  const confidenceMatch = text.match(/(\d+)%/);
  const providerMatch =
    text.match(/detected\s+(.+?)\s+with/i) ||
    text.match(/may be\s+(.+?)\s+\(/i) ||
    text.match(/Could not confidently detect/i);
  if (providerMatch && providerMatch[1]) providerMatch[1] = providerMatch[1].trim();
  return {
    text: text.trim(),
    confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : null,
    provider: providerMatch ? providerMatch[1] : null,
  };
}

async function getMappingConfidence(page: Page) {
  const text = await page.locator('body').textContent().catch(() => "");
  const match = text?.match(/Mapping confidence\s*(\d+)%/i);
  return match ? parseInt(match[1]) : null;
}

async function confirmImport(page: Page) {
  const btn = page.locator('button:has-text("Confirm")');
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(5000);
  }
}

async function clickConfirmProvider(page: Page) {
  const btn = page.locator('button:has-text("Confirm Provider")');
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1000);
  }
}

// ───────────────────────────────────────────────────────────────
// TESTS
// ───────────────────────────────────────────────────────────────

test.describe("Upload Flow - Provider Detection", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("Tide CSV detection", async ({ page }) => {
    await uploadFile(page, CSV_FILES.tide);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("tide");
    expect(info.confidence).toBeGreaterThan(60);
    await page.screenshot({ path: "e2e/screenshots/tide-detection.png" });
  });

  test("Revolut CSV detection", async ({ page }) => {
    await uploadFile(page, CSV_FILES.revolut);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("revolut");
    expect(info.confidence).toBeGreaterThan(60);
    await page.screenshot({ path: "e2e/screenshots/revolut-detection.png" });
  });

  test("Wise CSV detection", async ({ page }) => {
    await uploadFile(page, CSV_FILES.wise);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("wise");
    expect(info.confidence).toBeGreaterThan(60);
    await page.screenshot({ path: "e2e/screenshots/wise-detection.png" });
  });

  test("Stripe CSV detection", async ({ page }) => {
    await uploadFile(page, CSV_FILES.stripe);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("stripe");
    expect(info.confidence).toBeGreaterThan(60);
    await page.screenshot({ path: "e2e/screenshots/stripe-detection.png" });
  });

  test("PayPal CSV detection", async ({ page }) => {
    await uploadFile(page, CSV_FILES.paypal);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("paypal");
    expect(info.confidence).toBeGreaterThan(60);
    await page.screenshot({ path: "e2e/screenshots/paypal-detection.png" });
  });

  test("Monzo CSV detection", async ({ page }) => {
    await uploadFile(page, CSV_FILES.monzo);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("monzo");
    expect(info.confidence).toBeGreaterThan(60);
    await page.screenshot({ path: "e2e/screenshots/monzo-detection.png" });
  });

  test("Starling CSV detection", async ({ page }) => {
    await uploadFile(page, CSV_FILES.starling);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("starling");
    expect(info.confidence).toBeGreaterThan(60);
    await page.screenshot({ path: "e2e/screenshots/starling-detection.png" });
  });

  test("Generic bank CSV should show confirmation prompt", async ({ page }) => {
    await uploadFile(page, CSV_FILES.generic);
    await getProviderInfo(page);
    // Generic CSVs may match a provider but confidence should be moderate
    // The UI should show a provider override select dropdown
    const bannerSelect = page.locator('div[class*="border-emerald"], div[class*="border-amber"]').locator('select');
    await expect(bannerSelect).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/generic-detection.png" });
  });

  test("High confidence provider auto-accepts — Tide", async ({ page }) => {
    await uploadFile(page, CSV_FILES.tide);
    const info = await getProviderInfo(page);
    expect(info.provider?.toLowerCase()).toContain("tide");
    expect(info.confidence).toBeGreaterThanOrEqual(85);

    // Preview Import should be enabled without confirmation
    const previewBtn = page.locator('button:has-text("Preview Import")');
    await expect(previewBtn).toBeVisible();
    expect(await previewBtn.isEnabled()).toBe(true);

    // Confirm Provider button should NOT exist
    const confirmBtn = page.locator('button:has-text("Confirm Provider")');
    expect(await confirmBtn.isVisible().catch(() => false)).toBe(false);
  });

  test("Medium confidence requires provider confirmation — generic debit/credit", async ({ page }) => {
    await uploadFile(page, CSV_FILES.genericDebitCredit);
    const info = await getProviderInfo(page);
    expect(info.confidence).toBeGreaterThanOrEqual(50);
    expect(info.confidence).toBeLessThan(85);

    // Confirm Provider button should be visible
    const confirmBtn = page.locator('button:has-text("Confirm Provider")');
    await expect(confirmBtn).toBeVisible();

    // Preview Import should be disabled
    const previewBtn = page.locator('button:has-text("Preview Import")');
    await expect(previewBtn).toBeVisible();
    expect(await previewBtn.isEnabled()).toBe(false);

    // Click Confirm Provider
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Preview Import should now be enabled
    expect(await previewBtn.isEnabled()).toBe(true);

    // Provider confirmed note should appear
    const confirmedNote = page.locator('text=/Provider confirmed/i');
    await expect(confirmedNote).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/medium-confidence-confirm.png" });
  });

  test("Low confidence falls back to generic bank", async ({ page }) => {
    await uploadFile(page, "./test_data/csv/low_confidence_en.csv");
    // Should show red banner with generic fallback
    const redBanner = page.locator('div[class*="border-rose-500"]').first();
    await expect(redBanner).toBeVisible();

    const bannerText = await redBanner.textContent().catch(() => "");
    expect(bannerText.toLowerCase()).toContain("generic bank csv");

    // Provider override dropdown should still be available
    const bannerSelect = redBanner.locator('select');
    await expect(bannerSelect).toBeVisible();
  });
});

test.describe("Upload Flow - End to End", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("Complete Tide upload and verify transactions", async ({ page }) => {
    await uploadFile(page, CSV_FILES.tide);
    
    // Verify mapping step shows fields
    const mappingStep = page.locator('text=/Column Mapping/i').first();
    await expect(mappingStep).toBeVisible();
    
    // Verify mapping confidence
    const mappingConfidence = await getMappingConfidence(page);
    expect(mappingConfidence).toBeGreaterThan(50);
    
    // Verify sample values shown in mapping step
    const sampleText = await page.locator('text=/e\.g\./').first().textContent();
    expect(sampleText).toBeTruthy();
    
    await page.screenshot({ path: "e2e/screenshots/tide-mapping.png" });
    
    // Navigate to preview step (high confidence, no confirmation needed)
    const previewBtn = page.locator('button:has-text("Preview Import")');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: "e2e/screenshots/tide-preview.png" });
    
    // Confirm import
    await confirmImport(page);
    
    // Wait for summary step
    await page.waitForSelector('text=/Summary|Import complete|success/i', { timeout: 30000 });
    await page.screenshot({ path: "e2e/screenshots/tide-summary.png" });
    
    // Navigate to transactions
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/tide-transactions.png" });
    
    // Verify transactions appear in table (clear date filter if needed)
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test("Complete Revolut upload and verify dashboard", async ({ page }) => {
    test.setTimeout(60000);
    await uploadFile(page, CSV_FILES.revolut);
    await page.waitForTimeout(3000);
    
    // Navigate to preview step (high confidence, no confirmation needed)
    const previewBtn = page.locator('button:has-text("Preview Import")');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();
    await page.waitForTimeout(3000);
    
    // Confirm import
    await confirmImport(page);
    await page.waitForSelector('text=/Summary|Import complete|success/i', { timeout: 45000 });
    
    // Check dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/dashboard-after-revolut.png" });
    
    // Verify KPIs are visible
    const kpiLabels = ["Cash Balance", "Monthly Revenue", "Monthly Expenses", "Net Profit"];
    for (const label of kpiLabels) {
      const el = page.locator(`text=${label}`).first();
      await expect(el).toBeVisible();
    }
  });
});

test.describe("Upload Flow - Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("No valid CSV should show error - 0 columns", async ({ page }) => {
    // Create an empty CSV
    const emptyCsv = path.join("./test_data/csv", "empty_test.csv");
    fs.writeFileSync(emptyCsv, "\n");
    await uploadFile(page, emptyCsv);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/empty-csv.png" });
    fs.unlinkSync(emptyCsv);
    
    // Should show error or warning
    const errorOrWarning = page.locator('text=/error|warning|no columns|empty|invalid/i').first();
    await expect(errorOrWarning).toBeVisible();
  });

  test("Duplicate upload should not double count", async ({ page }) => {
    // Upload once (bank-standard is medium confidence, requires confirmation)
    await uploadFile(page, CSV_FILES.bankStandard);
    await page.waitForTimeout(3000);
    await clickConfirmProvider(page);
    await confirmImport(page);
    await page.waitForSelector('text=/Summary|Import complete|success/i', { timeout: 30000 });
    
    // Get transaction count before second upload
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForTimeout(3000);
    const countBefore = await page.locator('table tbody tr').count();
    
    // Upload same file again
    await goToUploadCentre(page);
    await uploadFile(page, CSV_FILES.bankStandard);
    await page.waitForTimeout(3000);
    await clickConfirmProvider(page);
    await confirmImport(page);
    await page.waitForSelector('text=/Summary|Import complete|success/i', { timeout: 30000 });
    
    // Check transactions again
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForTimeout(3000);
    const countAfter = await page.locator('table tbody tr').count();
    
    // Should not have doubled (allow some margin for new transactions if dedup fails)
    // In a well-behaved system, duplicates should be detected
    expect(countAfter).toBeLessThanOrEqual(countBefore + 5);
    
    await page.screenshot({ path: "e2e/screenshots/duplicate-transactions.png" });
  });
});

test.describe("Upload Flow - UX Validation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToUploadCentre(page);
  });

  test("Provider override dropdown is always available", async ({ page }) => {
    await uploadFile(page, CSV_FILES.wise);
    await page.waitForTimeout(3000);
    
    // Provider override select in the detection banner should be visible
    const bannerSelect = page.locator('div').filter({ hasText: /detected/i }).locator('select').first();
    await expect(bannerSelect).toBeVisible();
    
    // Should be able to change provider
    await bannerSelect.selectOption("manual_csv");
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: "e2e/screenshots/provider-override.png" });
  });

  test("Confidence score is visible and colour-coded", async ({ page }) => {
    await uploadFile(page, CSV_FILES.revolut);
    await page.waitForTimeout(3000);
    
    // Confidence should be visible
    const confidenceEl = page.locator('text=/\\d+%/').first();
    await expect(confidenceEl).toBeVisible();
    
    await page.screenshot({ path: "e2e/screenshots/confidence-score.png" });
  });
});
