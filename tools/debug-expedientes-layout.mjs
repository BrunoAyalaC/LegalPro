import { chromium } from 'playwright';

const FRONTEND = 'https://legalpro-frontend-production-a988.up.railway.app';
const NODE = 'https://legalpro-node-production-34ac.up.railway.app';

const login = await fetch(`${NODE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'abogado@legalpro.pe', password: 'Demo2024!' }),
});
const { token } = await login.json();
const host = new URL(NODE).hostname;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'token', value: token, domain: host, path: '/api', httpOnly: true, secure: true, sameSite: 'None' }]);
const page = await ctx.newPage();
await page.goto(`${FRONTEND}/expedientes`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.card')];
  return cards.slice(0, 8).map((el, i) => {
    const r = el.getBoundingClientRect();
    const img = el.querySelector('img');
    const ir = img?.getBoundingClientRect();
    return {
      i,
      cardH: Math.round(r.height),
      cardW: Math.round(r.width),
      text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60),
      imgH: ir ? Math.round(ir.height) : null,
      opacity: getComputedStyle(el).opacity,
      overflow: getComputedStyle(el).overflow,
      transform: getComputedStyle(el).transform,
    };
  });
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
