import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('legalpro_tour_completed','1'); } catch {} });

page.on('response', r => { if (r.url().includes('/api/auth/')) console.log('RESP', r.status(), r.url()); });

// login
await page.goto(`${BASE}/login`);
await page.locator('#login-email').fill('abogado@legalpro.pe');
await page.locator('#login-password').fill('Demo2024!');
await Promise.all([ page.waitForURL(/\/(dashboard|setup-organizacion)/, { timeout: 20000 }), page.locator('button[type="submit"]').click() ]);
console.log('after login url:', page.url());
console.log('cookies:', (await ctx.cookies()).map(c=>c.name).join(',') || 'none');

await page.goto(`${BASE}/perfil`);
const btn = page.locator('button:has-text("Cerrar sesión"), button:has-text("Cerrar Sesión")').first();
await btn.waitFor({ state: 'visible', timeout: 15000 });
await Promise.all([ page.waitForResponse(r=>r.url().includes('/api/auth/logout'),{timeout:15000}).catch(()=>null), btn.click() ]);
await page.waitForTimeout(1500);
console.log('after logout url:', page.url());
console.log('cookies after logout:', (await ctx.cookies()).map(c=>c.name).join(',') || 'none');

await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(2500);
console.log('final url:', page.url());
console.log('cookies final:', (await ctx.cookies()).map(c=>c.name).join(',') || 'none');
const txt = await page.evaluate(()=>document.body.innerText.slice(0,120));
console.log('body text:', JSON.stringify(txt));

await browser.close();
