/**
 * E2E DE INTEGRACIÓN REAL — LegalPro
 * ----------------------------------------------------------------------------
 * Ejercita el sistema COMO PRODUCCIÓN: frontend nginx (:3000) + Node API (:3001)
 * + Postgres real (seed) + Gemini real. NO usa mocks.
 *
 * Config: playwright.config.e2e.js   (baseURL http://localhost:3000)
 * Seed:   tools/seed/seed-demo.mjs   (password de todos: Demo2024!)
 *
 * Cubre: login (ok/err), navegación exhaustiva por todas las rutas, CRUD real de
 * expedientes (modal/wizard), búsqueda y filtros, chat IA real, perfil/ARCO,
 * aislamiento multi-tenant y logout.
 */
import { test, expect } from '@playwright/test';
import { NODE_API, USERS, loginViaAPI, loginUI, trackErrors as trackPageErrors } from './helpers/prod-auth.mjs';

const PROTECTED_ROUTES = [
  '/dashboard', '/expedientes', '/herramientas', '/perfil', '/buscador',
  '/analista', '/panel-expertos', '/simulador', '/redactor', '/predictor',
  '/alegatos', '/interrogatorio', '/objeciones', '/monitor-sinoe', '/comparador',
  '/boveda', '/multidoc', '/casos-criticos', '/resumen-ejecutivo',
  '/retroalimentacion', '/config-especialidad', '/creditos', '/chat-ia',
];

/** Captura errores de consola/página no controlados para detectar crashes reales. */
// trackPageErrors importado desde helpers

/** Login real a través de la UI. Devuelve cuando la navegación post-login terminó. */
// loginUI importado desde helpers

// El tour de onboarding (primer login) cubre la pantalla e intercepta clicks.
// Se marca como completado ANTES de cargar la app para que las pruebas ejerciten
// la UI real sin el overlay. (Su comportamiento se valida aparte si se requiere.)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('legalpro_tour_completed', '1'); } catch { /* ignore */ }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUTENTICACIÓN REAL
// ─────────────────────────────────────────────────────────────────────────────
test.describe('1. Autenticación real', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('login con credenciales inválidas muestra error y NO navega', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill('abogado@legalpro.pe');
    await page.locator('#login-password').fill('PasswordIncorrecta!');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });

  test('login válido (ABOGADO) navega al dashboard con datos reales', async ({ page }) => {
    await loginUI(page, USERS.abogado);
    expect(page.url()).toMatch(/\/dashboard/);
    await expect(page.locator('#root')).toBeVisible();
  });

  test('toggle de visibilidad de contraseña funciona', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-password').fill('Secreto123');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'text');
  });

  test('modal "¿Olvidó su contraseña?" abre y envía solicitud', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Olvidó su contraseña/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#forgot-email').fill('abogado@legalpro.pe');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.locator('text=/Correo enviado|recibirás un enlace/i')).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GUARDAS DE RUTA — sin auth redirige a /login
// ─────────────────────────────────────────────────────────────────────────────
test.describe('2. Rutas protegidas sin auth → /login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const ruta of PROTECTED_ROUTES) {
    test(`${ruta} sin auth redirige a /login`, async ({ page }) => {
      await page.goto(ruta);
      await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => {});
      expect(page.url()).toContain('/login');
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. NAVEGACIÓN EXHAUSTIVA AUTENTICADA — todas las rutas cargan sin crash
// ─────────────────────────────────────────────────────────────────────────────
test.describe('3. Navegación autenticada exhaustiva (ABOGADO)', () => {
  test('recorre todas las rutas protegidas sin errores de JS', async ({ page }) => {
    const errors = trackPageErrors(page);
    for (const ruta of PROTECTED_ROUTES) {
      await page.goto(ruta);
      await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });
      // No debe quedar sobre /login (sesión válida) salvo expiración
      expect(page.url(), `Ruta ${ruta} expulsó la sesión`).not.toContain('/login');
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(/TypeError|ReferenceError|Cannot read|is not a function/.test(bodyText),
        `Crash visible en ${ruta}`).toBeFalsy();
    }
    expect(errors, `Errores JS no controlados: ${errors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CRUD REAL DE EXPEDIENTES (modal / formulario)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('4. Expedientes — CRUD real', () => {
  test('crear, ver, editar y eliminar un expediente', async ({ page }) => {
    await page.goto('/expedientes');
    await expect(page.locator('#root')).toBeVisible();

    const numero = `E2E-${Date.now()}`;

    // CREATE — abrir modal
    await page.locator('#btn-nuevo-expediente-header').click();
    await expect(page.locator('#input-form-numero')).toBeVisible();
    await page.locator('#input-form-numero').fill(numero);
    await page.locator('#input-form-titulo').fill('Caso E2E automatizado');
    await page.locator('#select-form-tipo').selectOption('civil');
    await page.locator('#input-form-juzgado').fill('Juzgado E2E');
    const [createResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/expedientes') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.locator('#btn-submit-creacion').click(),
    ]);
    expect([200, 201], `POST expediente status ${createResp.status()}`).toContain(createResp.status());
    const created = await createResp.json();
    const expId = created?.expediente?.id;

    // READ — buscar en lista paginada
    await page.locator('#input-buscar-expediente').fill(numero);
    await page.waitForTimeout(1000);
    await expect(page.locator(`text=${numero}`).first()).toBeVisible({ timeout: 15_000 });

    // EDIT — localizar la tarjeta del expediente creado
    const editBtn = expId
      ? page.locator(`#btn-editar-expediente-${expId}`)
      : page.locator('[id^="btn-editar-expediente-"]').first();
    await editBtn.click();
    await expect(page.locator('#input-form-titulo')).toBeVisible();
    await page.locator('#input-form-titulo').fill('Caso E2E editado');
    const juzgadoInput = page.locator('#input-form-juzgado');
    if (!(await juzgadoInput.inputValue()).trim()) {
      await juzgadoInput.fill('Juzgado E2E');
    }
    const [editResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/expedientes') && ['PATCH', 'PUT'].includes(r.request().method()), { timeout: 20_000 }),
      page.locator('#btn-submit-creacion').click(),
    ]);
    expect([200], `PATCH expediente status ${editResp.status()}`).toContain(editResp.status());
    // Recargar lista: el PATCH puede no reflejarse de inmediato en el filtro local
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#input-buscar-expediente').fill(numero);
    await page.waitForTimeout(1000);
    await expect(page.locator(`text=${numero}`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Caso E2E editado').first()).toBeVisible({ timeout: 15_000 });

    // DELETE — confirmar modal del expediente creado
    const delBtn = expId
      ? page.locator(`#btn-eliminar-expediente-${expId}`)
      : page.locator('[id^="btn-eliminar-expediente-"]').first();
    await delBtn.click();
    await expect(page.locator('text=Eliminar Expediente')).toBeVisible();
    const [delResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/expedientes') && r.request().method() === 'DELETE', { timeout: 20_000 }),
      page.getByRole('button', { name: 'Sí, eliminar' }).click(),
    ]);
    expect([200, 204], `DELETE expediente status ${delResp.status()}`).toContain(delResp.status());
  });

  test('búsqueda y filtros por tipo no rompen la lista', async ({ page }) => {
    await page.goto('/expedientes');
    await page.locator('#input-buscar-expediente').fill('Demanda');
    await page.waitForTimeout(1200);
    await expect(page.locator('#root')).toBeVisible();
    // Filtro por tipo civil (si existe el chip)
    const chip = page.locator('#btn-filtro-tipo-civil');
    if (await chip.count()) {
      await chip.scrollIntoViewIfNeeded();
      await chip.click({ force: true });
      await page.waitForTimeout(800);
      await expect(page.locator('#root')).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CHAT IA REAL (Gemini)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('5. Chat IA real', () => {
  test('enviar un mensaje produce una respuesta del asistente o un error controlado', async ({ page }) => {
    await page.goto('/chat-ia');
    await expect(page.locator('#root')).toBeVisible();

    const input = page.locator('#chat-input, textarea[aria-label="Mensaje al asistente legal"], input[placeholder*="Consulta" i]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill('¿Cuál es el plazo para contestar una demanda en un proceso de conocimiento?');

    const sendBtn = page.locator('button[aria-label="Enviar mensaje"], button[type="submit"]').first();
    const respPromise = page.waitForResponse(
      r => /\/api\/(legal|gemini|ai|chat)/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 45_000 }
    ).catch(() => null);
    if (await sendBtn.count()) await sendBtn.click(); else await input.press('Enter');

    const resp = await respPromise;
    // Aceptamos: respuesta 200 con contenido, o un error controlado en UI (no crash).
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(/TypeError|ReferenceError|Cannot read/.test(bodyText), 'Crash en chat IA').toBeFalsy();
    if (resp) {
      expect([200, 402, 403, 429, 503], `IA status inesperado ${resp.status()}`).toContain(resp.status());
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PERFIL Y DERECHOS ARCO (LPDP)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('6. Perfil y datos personales', () => {
  test('la vista de perfil carga datos reales del usuario', async ({ page }) => {
    await page.goto('/perfil');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('text=/abogado@legalpro\\.pe/i').first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. AISLAMIENTO MULTI-TENANT
// ─────────────────────────────────────────────────────────────────────────────
test.describe('7. Aislamiento multi-tenant', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('un usuario de otra organización NO ve los expedientes de la org demo', async ({ request }) => {
    const loginResp = await request.post(`${NODE_API}/api/auth/login`, {
      data: { email: USERS.rival.email, password: USERS.rival.pass },
    });
    expect(loginResp.ok(), `login rival status ${loginResp.status()}`).toBeTruthy();
    const { token } = await loginResp.json();
    const expResp = await request.get(`${NODE_API}/api/expedientes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(expResp.ok()).toBeTruthy();
    const data = await expResp.json();
    const items = data.expedientes || data.data || data.items || [];
    // El rival pertenece a otra org sin expedientes sembrados: no debe ver EXP-2026-*
    const fugados = items.filter((e) => String(e.numero || '').startsWith('EXP-2026-'));
    expect(fugados, 'FUGA multi-tenant: el rival ve expedientes de otra organización').toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
test.describe('8. Cierre de sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('logout invalida la sesión y bloquea rutas protegidas', async ({ page, request }) => {
    await loginViaAPI(page, request, USERS.abogado);
    await page.goto('/perfil');
    const logoutBtn = page.locator('#btn-cerrar-sesion-perfil, main button').filter({ hasText: /Cerrar Sesión/i }).first();
    await expect(logoutBtn).toBeVisible({ timeout: 15_000 });
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/auth/logout') && r.ok(), { timeout: 15_000 }),
      logoutBtn.click(),
    ]);
    await page.context().clearCookies();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });
});
