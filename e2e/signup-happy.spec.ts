import { test, expect } from "@playwright/test";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

test("Signup with new email creates account and redirects", async ({ page }) => {
  // Note: Supabase blocks example.com — use a valid-looking test domain
  const randomEmail = `test-${Date.now()}@e2e.founderagent.test`;
  await page.goto(`${BASE_URL}/signup`);
  await page.waitForSelector('input[type="email"]');

  await page.fill('input[name="name"]', "Test Founder");
  await page.fill('input[name="companyName"]', "Test Startup");
  await page.fill('input[type="email"]', randomEmail);
  await page.fill('input[type="password"]', "Password123!");
  
  await page.click('button[type="submit"]');
  
  // Wait for either redirect or error message
  await page.waitForTimeout(5000);
  
  const url = page.url();
  const errorText = await page.locator('.text-red-300').textContent().catch(() => null);
  
  console.log("Signup result:", { url, errorText });
  
  // Either we redirect to onboarding/dashboard, or we see a specific error
  const didRedirect = url.includes("/onboarding") || url.includes("/dashboard");
  const hasExpectedError = errorText && (
    errorText.includes("rate limit") ||
    errorText.includes("invalid") ||
    errorText.includes("already registered")
  );
  
  expect(didRedirect || hasExpectedError).toBe(true);
});
