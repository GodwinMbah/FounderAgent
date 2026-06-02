import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TEST_USER = { email: "demo@acmelabs.com", password: "Demo1234!" };

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "small-tablet", width: 768, height: 1024 },
  { name: "large-mobile", width: 430, height: 932 },
  { name: "small-mobile", width: 390, height: 844 },
];

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

for (const vp of VIEWPORTS) {
  test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("Login page renders correctly", async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      await page.screenshot({ path: `e2e/screenshots/viewport-${vp.name}-login.png` });
    });

    test("Dashboard loads with global date picker visible", async ({ page }) => {
      await login(page);
      await page.waitForTimeout(2000);

      // Global date picker is in the TopBar header
      const datePicker = page.locator('header button').filter({ has: page.locator('svg[class*="lucide-calendar"]') }).first();
      await expect(datePicker).toBeVisible();

      await page.screenshot({ path: `e2e/screenshots/viewport-${vp.name}-dashboard.png` });
    });

    test("Sidebar navigation works", async ({ page }) => {
      await login(page);
      await page.waitForTimeout(2000);

      const isMobile = vp.width < 768;

      if (isMobile) {
        // Hamburger menu should be visible on mobile
        const _hamburger = page.locator('button[aria-label*="menu"], button svg[data-testid*="menu"]').first();
        // Some implementations use specific icons; fallback to any button in header area
        const menuBtn = page.locator('header > button').first();
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();
        await page.waitForTimeout(500);
      }

      // Verify Upload Centre link is accessible
      const uploadLink = page.locator('a[href^="/upload-centre"]').first();
      await expect(uploadLink).toBeVisible();
      await uploadLink.click();
      await page.waitForURL(`${BASE_URL}/upload-centre`, { timeout: 10000 });
      await expect(page.locator('h1:has-text("Upload Centre")')).toBeVisible();

      await page.screenshot({ path: `e2e/screenshots/viewport-${vp.name}-sidebar.png` });
    });

    test("Transactions page loads with global date picker visible", async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/transactions`);
      await page.waitForTimeout(2000);

      // Global date picker in TopBar should be visible on all pages
      const datePicker = page.locator('header button').filter({ has: page.locator('svg[class*="lucide-calendar"]') }).first();
      await expect(datePicker).toBeVisible();

      await page.screenshot({ path: `e2e/screenshots/viewport-${vp.name}-transactions.png` });
    });

    test("Upload Centre accessible", async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/upload-centre`);
      await page.waitForTimeout(2000);

      await expect(page.locator('h1:has-text("Upload Centre")')).toBeVisible();
      await expect(page.locator('input[type="file"]')).toBeAttached();

      await page.screenshot({ path: `e2e/screenshots/viewport-${vp.name}-upload-centre.png` });
    });
  });
}
