/**
 * Auditoría UI/UX producción — capturas + métricas + chat real
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-production-a988.up.railway.app';
const NODE = process.env.E2E_NODE_API_URL || 'https://legalpro-node-production-34ac.up.railway.app';
const OUT = path.join(process.cwd(), 'tools', 'audit-screenshots');
const USER = { email: 'abogado@legalpro.pe', pass: 'Demo2024!' };

fs.mkdirSync(OUT, { recursive: true });

const report = {
  timestamp: new Date().toISOString(),
  frontend: FRONTEND,
  pages: [],
  chat: null,
  issues: [],
  positives: [],
};

async function loginViaAPI(context) {
  const r = await context.request.post(`${NODE}/api/auth/login`, {
    data: { email: USER.email, password: USER.pass },
  });
  if (!r.ok()) throw new Error(`Login API ${r.status()}`);
  const { token } = await r.json();
  const host = new URL(NODE).hostname;
  await context.addCookies([{
    name: 'token', value: token, domain: host, path: '/api',
    httpOnly: true, secure: true, sameSite: 'None',
  }]);
  return token;
}

async function auditPage(page, name, url, viewport) {
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e.message)));
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const loadMs = Date.now() - t0;
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  const hasCrash = /TypeError|ReferenceError|Cannot read properties|500 Internal/.test(bodyText);
  const hasEmptyRoot = await page.evaluate(() => {
    const root = document.querySelector('#root');
    return !root || root.innerText.trim().length < 10;
  });
  const screenshot = path.join(OUT, `${name}-${viewport.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const entry = {
    name, url, viewport: viewport.name, status: resp?.status(),
    loadMs, title, jsErrors, hasCrash, hasEmptyRoot, screenshot,
  };
  report.pages.push(entry);
  if (hasCrash) report.issues.push(`${name} (${viewport.name}): posible crash en UI`);
  if (jsErrors.length) report.issues.push(`${name} (${viewport.name}): JS errors: ${jsErrors.join('; ')}`);
  if (hasEmptyRoot && !url.includes('/landing')) report.issues.push(`${name} (${viewport.name}): pantalla casi vacía`);
  if (loadMs > 8000) report.issues.push(`${name} (${viewport.name}): carga lenta (${loadMs}ms)`);
  return entry;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await loginViaAPI(context);

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const routes = [
  { name: 'landing', path: '/landing/', auth: false },
  { name: 'login', path: '/login', auth: false },
  { name: 'dashboard', path: '/dashboard', auth: true },
  { name: 'expedientes', path: '/expedientes', auth: true },
  { name: 'chat-ia', path: '/chat-ia', auth: true },
  { name: 'herramientas', path: '/herramientas', auth: true },
  { name: 'redactor', path: '/redactor', auth: true },
  { name: 'simulador', path: '/simulador', auth: true },
  { name: 'perfil', path: '/perfil', auth: true },
];

for (const vp of viewports) {
  const page = await context.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const route of routes) {
    if (!route.auth) {
      const guest = await browser.newContext();
      const gp = await guest.newPage();
      await gp.setViewportSize({ width: vp.width, height: vp.height });
      await auditPage(gp, route.name, `${FRONTEND}${route.path}`, vp);
      await guest.close();
    } else {
      await auditPage(page, route.name, `${FRONTEND}${route.path}`, vp);
    }
  }
  await page.close();
}

// Chat profundo
const chatPage = await context.newPage();
await chatPage.setViewportSize({ width: 1440, height: 900 });
await chatPage.goto(`${FRONTEND}/chat-ia`, { waitUntil: 'domcontentloaded' });
await chatPage.waitForTimeout(2000);

const input = chatPage.locator('textarea, input[placeholder*="Consulta" i], input[type="text"]').first();
const inputVisible = await input.isVisible().catch(() => false);
let chatResult = { inputVisible, apiStatus: null, hasAssistantReply: false, responseSnippet: '', uiErrors: [] };

if (inputVisible) {
  await input.fill('Resume en 2 líneas el plazo para contestar demanda civil en Perú.');
  const respP = chatPage.waitForResponse(
    (r) => /\/api\/(ai|gemini|legal|chat)/.test(r.url()) && r.request().method() === 'POST',
    { timeout: 90000 },
  ).catch(() => null);
  const sendBtn = chatPage.locator('button[aria-label="Enviar mensaje"], button[type="submit"]').first();
  if (await sendBtn.count()) await sendBtn.click();
  else await input.press('Enter');
  const resp = await respP;
  if (resp) {
    chatResult.apiStatus = resp.status();
    try {
      const body = await resp.json();
      chatResult.responseSnippet = JSON.stringify(body).slice(0, 300);
    } catch { /* ignore */ }
  }
  await chatPage.waitForTimeout(8000);
  const bodyAfter = await chatPage.evaluate(() => document.body.innerText);
  chatResult.hasAssistantReply = /demanda|plazo|días|contestar|civil|Perú/i.test(bodyAfter);
  chatResult.uiErrors = bodyAfter.match(/error|400|403|429|sin créditos|bloqueado/gi) || [];
  await chatPage.screenshot({ path: path.join(OUT, 'chat-after-send-desktop.png'), fullPage: true });
}

report.chat = chatResult;
if (!inputVisible) report.issues.push('Chat: input no visible');
if (chatResult.apiStatus === 400) report.issues.push('Chat: API devuelve 400 (disclaimer/campos)');
if (chatResult.apiStatus === 403) report.issues.push('Chat: API 403 (LPDP/consentimiento)');
if (chatResult.apiStatus === 402 || chatResult.apiStatus === 429) report.issues.push(`Chat: API ${chatResult.apiStatus} (créditos/rate limit)`);
if (chatResult.apiStatus === 200 && !chatResult.hasAssistantReply) report.issues.push('Chat: 200 pero sin texto de respuesta visible en UI');
if (chatResult.apiStatus === 200 && chatResult.hasAssistantReply) report.positives.push('Chat IA responde correctamente en producción');

// Landing root redirect
const landPage = await browser.newPage();
const landResp = await landPage.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
await landPage.waitForTimeout(2000);
const rootUrl = landPage.url();
report.landingRedirect = { from: FRONTEND, to: rootUrl, status: landResp?.status() };
if (!rootUrl.includes('/landing')) report.issues.push(`Root / no redirige a /landing/ (actual: ${rootUrl})`);
else report.positives.push('Landing premium accesible vía redirect desde /');

await browser.close();

const reportPath = path.join(OUT, 'audit-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\n=== AUDITORÍA UI/UX PRODUCCIÓN ===\n');
console.log(`Páginas auditadas: ${report.pages.length}`);
console.log(`Issues: ${report.issues.length}`);
report.issues.forEach((i) => console.log(`  ⚠ ${i}`));
console.log(`Positivos: ${report.positives.length}`);
report.positives.forEach((p) => console.log(`  ✓ ${p}`));
console.log('\nChat:', JSON.stringify(report.chat, null, 2));
console.log('\nLanding:', JSON.stringify(report.landingRedirect, null, 2));
console.log(`\nReporte: ${reportPath}`);
console.log(`Capturas: ${OUT}`);
