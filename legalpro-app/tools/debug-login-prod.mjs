import { chromium } from 'playwright';

const FRONTEND = process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-staging.up.railway.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
await page.fill('#login-email', 'abogado@legalpro.pe');
await page.fill('#login-password', 'Demo2024!');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);
console.log('url', page.url());
console.log('error', await page.locator('[role="alert"], .text-red, [class*="error"]').allTextContents().catch(() => []));
console.log('body', (await page.locator('body').innerText()).slice(0, 400));
await page.screenshot({ path: 'tools/audit-screenshots/login-debug.png' });
await browser.close();
