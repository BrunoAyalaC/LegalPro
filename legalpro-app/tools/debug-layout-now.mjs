import { chromium } from 'playwright';

const FRONTEND = 'https://legalpro-frontend-production-a988.up.railway.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
await page.fill('#login-email', 'abogado@legalpro.pe');
await page.fill('#login-password', 'Demo2024!');
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
await page.waitForTimeout(2000);

await page.click('a[href="/expedientes"], nav a:has-text("Expedientes")');
await page.waitForURL(/\/expedientes/, { timeout: 15000 });
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const wrap = document.querySelector('.layout-main-shell');
  const card = document.querySelector('.card, .expediente-row, [class*="expediente"]');
  const sidebar = document.querySelector('aside');
  const wr = wrap?.getBoundingClientRect();
  const cr = card?.getBoundingClientRect();
  return {
    url: location.pathname,
    wrapClass: wrap?.className?.slice(0, 100),
    wrapPadding: wrap ? getComputedStyle(wrap).paddingLeft : null,
    cardX: cr?.x,
    cardW: cr?.width,
    sidebarW: sidebar?.getBoundingClientRect().width,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
