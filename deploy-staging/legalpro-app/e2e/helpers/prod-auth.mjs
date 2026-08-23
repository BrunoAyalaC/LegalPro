import { expect } from '@playwright/test';

export const NODE_API =
  process.env.E2E_NODE_API_URL || 'https://legalpro-node-production-34ac.up.railway.app';

export const USERS = {
  abogado:  { email: 'abogado@legalpro.pe',  pass: 'Demo2024!', rol: 'ABOGADO' },
  admin:    { email: 'admin@legalpro.pe',    pass: 'Demo2024!', rol: 'ABOGADO' },
  fiscal:   { email: 'fiscal@legalpro.pe',   pass: 'Demo2024!', rol: 'FISCAL' },
  juez:     { email: 'juez@legalpro.pe',     pass: 'Demo2024!', rol: 'JUEZ' },
  contador: { email: 'contador@legalpro.pe', pass: 'Demo2024!', rol: 'CONTADOR' },
  rival:    { email: 'rival@otroestudio.pe', pass: 'Demo2024!', rol: 'ABOGADO' },
};

/** Inyecta cookie de sesión en el dominio Node (cross-origin Railway). */
async function injectSessionCookie(context, token) {
  const host = new URL(NODE_API).hostname;
  await context.addCookies([{
    name: 'token',
    value: token,
    domain: host,
    path: '/api',
    httpOnly: true,
    secure: true,
    sameSite: 'None',
  }]);
}

/** Espera a que AuthGuard termine de rehidratar sesión. */
export async function waitForAuthReady(page) {
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]') && !window.location.pathname.includes('/login'),
    { timeout: 30_000 },
  ).catch(async () => {
    await page.waitForURL(/\/(dashboard|expedientes|herramientas|setup-organizacion)/, { timeout: 15_000 });
  });
}

/** Login vía API + cookie explícita — funciona con frontend/API en dominios distintos. */
export async function loginViaAPI(page, request, user, retries = 2) {
  const context = page.context();
  for (let i = 0; i <= retries; i++) {
    const r = await request.post(`${NODE_API}/api/auth/login`, {
      data: { email: user.email, password: user.pass },
    });
    if (r.ok()) {
      const { token } = await r.json();
      expect(token).toBeTruthy();
      await injectSessionCookie(context, token);
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await waitForAuthReady(page);
      expect(page.url()).not.toContain('/login');
      return;
    }
    if (r.status() === 429 && i < retries) {
      const wait = Number(r.headers()['retry-after'] || 3) * 1000 + 500;
      await page.waitForTimeout(wait);
      continue;
    }
    expect(r.ok(), `login API ${user.email} status ${r.status()}`).toBeTruthy();
  }
}

/** Login real por formulario (solo para tests que ejercitan la UI de login). */
export async function loginUI(page, user) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill(user.pass);
  await Promise.all([
    page.waitForURL(/\/(dashboard|setup-organizacion|herramientas)/, { timeout: 45_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return errors;
}

export const ROUTES = [
  '/dashboard', '/expedientes', '/herramientas', '/perfil', '/buscador',
  '/analista', '/panel-expertos', '/simulador', '/redactor', '/predictor',
  '/alegatos', '/interrogatorio', '/objeciones', '/monitor-sinoe', '/comparador',
  '/boveda', '/multidoc', '/casos-criticos', '/resumen-ejecutivo',
  '/retroalimentacion', '/config-especialidad', '/creditos', '/chat-ia',
];

export const IA_ROUTES = ['/chat-ia', '/analista', '/redactor', '/predictor', '/simulador', '/buscador'];
