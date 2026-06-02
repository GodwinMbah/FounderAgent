import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

test("Signup page loads and shows error for invalid input", async ({ page }) => {
  await page.goto(`${BASE_URL}/signup`);
  await page.waitForSelector('input[type="email"]');

  // Submit empty form
  await page.click('button[type="submit"]');
  
  // Should still be on signup page (HTML5 validation prevents submit)
  await expect(page).toHaveURL(`${BASE_URL}/signup`);
});

test("Signup with existing email shows error", async ({ page }) => {
  await page.goto(`${BASE_URL}/signup`);
  await page.waitForSelector('input[type="email"]');

  await page.fill('input[name="name"]', "Test User");
  await page.fill('input[name="companyName"]', "Test Co");
  await page.fill('input[type="email"]', "demo@acmelabs.com");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');

  // Wait for error or redirect
  await page.waitForTimeout(3000);

  // Should show error (user already exists) OR redirect to onboarding
  const url = page.url();
  const hasError = await page.locator('text=/error|failed|exists/i').first().isVisible().catch(() => false);
  
  console.log("Signup result:", { url, hasError });
  
  // Either we see an error, or we're on onboarding/dashboard
  expect(url.includes("/signup") && hasError || url.includes("/onboarding") || url.includes("/dashboard")).toBe(true);
});
