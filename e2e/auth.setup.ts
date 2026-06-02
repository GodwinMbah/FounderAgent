import { test as setup } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const authDir = path.join(__dirname, "..", "playwright", ".auth");
const authFile = path.join(authDir, "user.json");

const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || "demo@acmelabs.com",
  password: process.env.E2E_TEST_PASSWORD || "Demo1234!",
};

setup("authenticate", async ({ page, baseURL }) => {
  const url = baseURL || "http://localhost:3000";

  // Ensure auth directory exists
  fs.mkdirSync(authDir, { recursive: true });

  // Attempt login
  await page.goto(`${url}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  // Small delay to ensure hydration completes before click
  await page.waitForTimeout(500);
  await page.click('button[type="submit"]');

  // Wait for dashboard to load (allow either URL change or content appearance)
  await page.waitForSelector('text=/Cash Balance|Dashboard|Command Centre/i', { timeout: 45000 });

  // Save storage state for authenticated tests
  await page.context().storageState({ path: authFile });

  console.log(`[auth.setup] Auth state saved to ${authFile} (server: ${url})`);
});
