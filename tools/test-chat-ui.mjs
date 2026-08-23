/**
 * Test UI chat — preview local con API prod
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-production-a988.up.railway.app';
const NODE = process.env.E2E_NODE_API_URL || 'https://legalpro-node-production-34ac.up.railway.app';
const OUT = path.join(process.cwd(), 'tools', 'audit-screenshots', 'chat-fix');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const login = await context.request.post(`${NODE}/api/auth/login`, {
  data: { email: 'abogado@legalpro.pe', password: 'Demo2024!' },
});
if (!login.ok()) throw new Error(`Login ${login.status()}`);
const { token } = await login.json();
const host = new URL(NODE).hostname;
await context.addCookies([{
  name: 'token', value: token, domain: host, path: '/api',
  httpOnly: true, secure: true, sameSite: 'None',
}]);

const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem('legalpro_tour_completed', '1');
  sessionStorage.setItem('legalpro_chat_disclaimer_dismissed', '1');
});

await page.goto(`${FRONTEND}/chat-ia`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="chat-shell"], #chat-input', { timeout: 30000 });

const checks = [];
const tourVisible = await page.locator('text=/Bienvenido al Dashboard/i').count();
checks.push({ name: 'Sin tour en chat', ok: tourVisible === 0 });

await page.screenshot({ path: path.join(OUT, '01-chat-empty.png') });

const shell = page.locator('[data-testid="chat-shell"]');
checks.push({ name: 'Chat shell visible', ok: await shell.isVisible() });

const input = page.locator('#chat-input');
checks.push({ name: 'Textarea input', ok: await input.isVisible() });

// Quick action
await page.getByRole('button', { name: 'Plazos' }).click();
await page.waitForTimeout(8000);

const tourAfter = await page.locator('text=/Bienvenido al Dashboard/i').count();
checks.push({ name: 'Sin tour durante chat', ok: tourAfter === 0 });

const hasReply = await page.locator('.chat-ai-content, .chat-ai').filter({ hasText: /plazo|demanda|civil|días/i }).count();
checks.push({ name: 'Respuesta IA visible', ok: hasReply > 0 });

await page.screenshot({ path: path.join(OUT, '02-chat-reply.png'), fullPage: true });

// Mobile
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
await mob.addCookies([{
  name: 'token', value: token, domain: host, path: '/api',
  httpOnly: true, secure: true, sameSite: 'None',
}]);
const mp = await mob.newPage();
await mp.addInitScript(() => {
  localStorage.setItem('legalpro_tour_completed', '1');
  sessionStorage.setItem('legalpro_chat_disclaimer_dismissed', '1');
});
await mp.goto(`${FRONTEND}/chat-ia`);
await mp.waitForTimeout(1500);
const inputMob = await mp.locator('#chat-input').isVisible();
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 20);
checks.push({ name: 'Mobile input visible', ok: inputMob });
checks.push({ name: 'Mobile sin overflow', ok: !overflow });
await mp.screenshot({ path: path.join(OUT, '03-chat-mobile.png') });

await browser.close();

console.log('\n=== CHAT UI TESTS (post-fix) ===\n');
let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} OK`);
console.log(`Capturas: ${OUT}`);
process.exit(failed > 0 ? 1 : 0);
