/**
 * Auditoría UI/UX producción — versión rápida (desktop + chat profundo)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-production-a988.up.railway.app';
const NODE = process.env.E2E_NODE_API_URL || 'https://legalpro-node-production-34ac.up.railway.app';
const OUT = path.join(process.cwd(), 'tools', 'audit-screenshots');
const USER = { email: 'abogado@legalpro.pe', pass: 'Demo2024!' };

fs.mkdirSync(OUT, { recursive: true });

const report = { timestamp: new Date().toISOString(), pages: [], chat: null, mobile: [], issues: [], positives: [] };

async function injectAuth(context) {
  const r = await context.request.post(`${NODE}/api/auth/login`, {
    data: { email: USER.email, password: USER.pass },
  });
  if (!r.ok()) throw new Error(`Login ${r.status()}`);
  const { token } = await r.json();
  const host = new URL(NODE).hostname;
  await context.addCookies([{
    name: 'token', value: token, domain: host, path: '/api',
    httpOnly: true, secure: true, sameSite: 'None',
  }]);
}

async function snap(page, name) {
  const jsErrors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (e) => jsErrors.push(String(e.message)));
  const t0 = Date.now();
  const resp = await page.goto(`${FRONTEND}${name}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1200);
  const loadMs = Date.now() - t0;
  const text = await page.evaluate(() => document.body.innerText);
  const crash = /TypeError|ReferenceError|Cannot read properties|500 Internal/.test(text);
  const file = path.join(OUT, `${name.replace(/\//g, '_')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const entry = { route: name, status: resp?.status(), loadMs, crash, jsErrors, file };
  report.pages.push(entry);
  if (crash) report.issues.push(`Crash UI en ${name}`);
  if (jsErrors.length) report.issues.push(`JS en ${name}: ${jsErrors[0]}`);
  if (loadMs > 6000) report.issues.push(`Lento ${name}: ${loadMs}ms`);
  return entry;
}

const browser = await chromium.launch({ headless: true });

// Landing redirect
const guest = await browser.newContext();
const gp = await guest.newPage();
await gp.setViewportSize({ width: 1440, height: 900 });
await gp.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
await gp.waitForTimeout(1500);
report.landing = { url: gp.url(), hasVideo: await gp.locator('video, [class*="hero"], .landing').count() > 0 };
await gp.screenshot({ path: path.join(OUT, 'root-landing.png'), fullPage: false });
if (!gp.url().includes('/landing')) report.issues.push(`Root no redirige a /landing/ → ${gp.url()}`);
else report.positives.push('Landing premium accesible desde /');
await guest.close();

// Desktop autenticado
const ctx = await browser.newContext();
await injectAuth(ctx);
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

const routes = ['/dashboard', '/expedientes', '/chat-ia', '/herramientas', '/redactor', '/simulador', '/perfil', '/login'];
for (const r of routes) await snap(page, r);

// Chat profundo
await page.goto(`${FRONTEND}/chat-ia`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const input = page.locator('textarea, input[placeholder*="Consulta" i]').first();
const chat = { inputVisible: await input.isVisible().catch(() => false), apiStatus: null, hasReply: false, snippet: '' };
if (chat.inputVisible) {
  await input.fill('¿Cuál es el plazo para contestar una demanda civil en Perú?');
  const respP = page.waitForResponse(
    (r) => /\/api\/(ai|gemini|legal|chat)/.test(r.url()) && r.request().method() === 'POST',
    { timeout: 90000 },
  );
  const btn = page.locator('button[aria-label="Enviar mensaje"], button[type="submit"]').first();
  if (await btn.count()) await btn.click(); else await input.press('Enter');
  const resp = await respP.catch(() => null);
  if (resp) {
    chat.apiStatus = resp.status();
    try { chat.snippet = JSON.stringify(await resp.json()).slice(0, 400); } catch { /* */ }
  }
  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => document.body.innerText);
  chat.hasReply = /demanda|plazo|días|contestar|civil|Perú|respuesta/i.test(after);
  await page.screenshot({ path: path.join(OUT, 'chat-after-reply.png'), fullPage: true });
}
report.chat = chat;
if (chat.apiStatus === 200 && chat.hasReply) report.positives.push('Chat IA: respuesta real visible');
else if (chat.apiStatus === 200) report.issues.push('Chat: API 200 pero respuesta no visible en UI');
else if (chat.apiStatus) report.issues.push(`Chat API status: ${chat.apiStatus}`);
else report.issues.push('Chat: sin respuesta API detectada (timeout o selector)');

// Mobile clave
const mob = await browser.newContext();
await injectAuth(mob);
const mp = await mob.newPage();
await mp.setViewportSize({ width: 390, height: 844 });
for (const r of ['/dashboard', '/chat-ia', '/expedientes']) {
  await mp.goto(`${FRONTEND}${r}`, { waitUntil: 'domcontentloaded' });
  await mp.waitForTimeout(1000);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 20);
  const file = path.join(OUT, `mobile${r.replace(/\//g, '_')}.png`);
  await mp.screenshot({ path: file, fullPage: false });
  report.mobile.push({ route: r, horizontalOverflow: overflow, file });
  if (overflow) report.issues.push(`Mobile overflow horizontal en ${r}`);
}
await mob.close();
await browser.close();

const outFile = path.join(OUT, 'audit-report.json');
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\nReporte: ${outFile}`);
