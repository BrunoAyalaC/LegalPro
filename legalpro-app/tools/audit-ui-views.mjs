/**
 * Auditoría visual UI — capturas prod con Playwright + métricas layout
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-production-a988.up.railway.app';
const OUT = path.join(process.cwd(), 'tools', 'audit-screenshots', 'views-fix');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
await page.fill('#login-email', 'abogado@legalpro.pe');
await page.fill('#login-password', 'Demo2024!');
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 });

await page.addInitScript(() => {
  localStorage.setItem('legalpro_tour_completed', '1');
  localStorage.setItem('lp_sidebar', 'expanded');
  sessionStorage.setItem('legalpro_chat_disclaimer_dismissed', '1');
  localStorage.removeItem('legalpro_chat_messages');
});

const routes = [
  { path: '/expedientes', name: 'expedientes' },
  { path: '/chat-ia', name: 'chat-ia' },
  { path: '/analista', name: 'analista' },
  { path: '/dashboard', name: 'dashboard' },
];

const report = [];

for (const r of routes) {
  await page.goto(`${FRONTEND}${r.path}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `${r.name}.png`), fullPage: true });

  const metrics = await page.evaluate(() => {
    const card = document.querySelector('.card');
    const sidebar = document.querySelector('aside');
    const userName = document.body.innerText.match(/Dr\.[^\n]+/)?.[0] || '';
    return {
      cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      userNameSnippet: userName.slice(0, 40),
      hasMojibake: /Ã|�/.test(document.body.innerText),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  report.push({ route: r.path, ...metrics });
}

await browser.close();

console.log('\n=== AUDITORÍA UI PROD ===\n');
for (const row of report) {
  console.log(JSON.stringify(row));
}
console.log(`\nCapturas: ${OUT}`);
