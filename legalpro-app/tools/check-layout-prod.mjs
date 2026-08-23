import { chromium } from 'playwright';

const FRONTEND = 'https://legalpro-frontend-production-a988.up.railway.app';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Login vía UI (cookie HttpOnly cross-origin)
await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
await page.fill('#login-email', 'abogado@legalpro.pe');
await page.fill('#login-password', 'Demo2024!');
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
await page.click('a[href="/expedientes"]');
await page.waitForURL(/\/expedientes/, { timeout: 15000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const wrap = document.querySelector('.layout-main-shell') || document.querySelector('[class*="lg:pl-"]');
  const card = document.querySelector('.card');
  const scripts = [...document.querySelectorAll('script[src*="assets/index"]')].map((s) => s.src);
  const styles = [...document.querySelectorAll('link[rel="stylesheet"][href*="assets/"]')].map((l) => l.href);
  const r = card?.getBoundingClientRect();
  const w = wrap?.getBoundingClientRect();
  return {
    wrapClass: wrap?.className || null,
    wrapPadding: wrap ? getComputedStyle(wrap).paddingLeft : null,
    cardX: r?.x,
    cardW: r?.width,
    wrapX: w?.x,
    scripts,
    styles,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
