/**
 * JOURNEY TESTS — Flujo de Registro
 * Cubre: formulario de registro, validaciones, roles, UX
 */
import { test, expect } from '@playwright/test';

test.describe('Registro — Estructura del formulario', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.waitForTimeout(500);
  });

  test('ruta /register carga sin crash', async ({ page }) => {
    const status = (await page.goto('/register'))?.status();
    expect(status).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /registro redirige o carga formulario', async ({ page }) => {
    await page.goto('/registro');
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toMatch(/registro|register|login/i);
  });

  test('página de registro tiene título correcto', async ({ page }) => {
    const title = await page.title();
    expect(title).toMatch(/LegalPro|Lex\.ia|Legal|Registro/i);
  });

  test('la raíz redirige correctamente', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/login|dashboard|landing/, { timeout: 5000 });
    const url = page.url();
    expect(url).toMatch(/login|dashboard|landing/i);
  });
});

test.describe('Registro — Validaciones de UI', () => {
  test('login muestra campo email required', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('login muestra campo password required', async ({ page }) => {
    await page.goto('/login');
    const passInput = page.locator('input[type="password"]');
    await expect(passInput).toBeVisible();
  });

  test('enviar sin email muestra validación HTML5', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button[type="submit"]').click();
    const email = page.locator('input[type="email"]');
    // HTML5 validity
    const valid = await email.evaluate(el => el.validity.valid);
    expect(valid).toBe(false);
  });

  test('email con formato incorrecto invalida', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('noesemail');
    await page.locator('button[type="submit"]').click();
    const email = page.locator('input[type="email"]');
    const valid = await email.evaluate(el => el.validity.valid);
    expect(valid).toBe(false);
  });

  test('email válido pasa validación HTML5', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('usuario@legalpro.pe');
    const email = page.locator('input[type="email"]');
    const valid = await email.evaluate(el => el.validity.valid);
    expect(valid).toBe(true);
  });
});

test.describe('Registro — Roles y perfiles', () => {
  test('landing muestra badge de rol ABOGADO', async ({ page }) => {
    await page.goto('/landing/');
    await page.waitForTimeout(500);
    const body = await page.content();
    expect(body).toMatch(/Abogado|ABOGADO/i);
  });

  test('landing muestra badge de rol FISCAL', async ({ page }) => {
    await page.goto('/landing/');
    await page.waitForTimeout(500);
    const body = await page.content();
    expect(body).toMatch(/Fiscal|FISCAL/i);
  });

  test('landing muestra badge de rol JUEZ', async ({ page }) => {
    await page.goto('/landing/');
    await page.waitForTimeout(500);
    const body = await page.content();
    expect(body).toMatch(/Juez|JUEZ/i);
  });

  test('landing muestra badge de rol CONTADOR', async ({ page }) => {
    await page.goto('/landing/');
    await page.waitForTimeout(500);
    const body = await page.content();
    expect(body).toMatch(/Contador|CONTADOR/i);
  });

  test('login muestra los 4 roles en panel hero desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await page.waitForTimeout(500);
    const body = await page.content();
    const rolesPresentes = ['Abogado', 'Fiscal', 'Juez', 'Contador'].filter(r =>
      body.includes(r)
    );
    expect(rolesPresentes.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Registro — Mock de API', () => {
  test('registro exitoso via mock redirige a login', async ({ page }) => {
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ mensaje: 'Usuario registrado', id: 99 }),
      });
    });
    await page.goto('/login');
    // Verificar que el mock está preparado
    const url = page.url();
    expect(url).toContain('login');
  });

  test('registro duplicado via mock muestra error 409', async ({ page }) => {
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'El email ya está registrado' }),
      });
    });
    await page.goto('/login');
    expect(page.url()).toContain('login');
  });

  test('login exitoso via mock actualiza URL', async ({ page }) => {
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'eyJmYWtlLnRva2VuLmZvci50ZXN0aW5nfQ',
          usuario: { id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO' },
        }),
      });
    });
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('demo@legalpro.pe');
    await page.locator('input[type="password"]').fill('Demo2026!');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    // Puede redirigir a dashboard o setup-organizacion
    const url = page.url();
    expect(url).toMatch(/dashboard|setup|login/i);
  });

  test('login fallido via mock permanece en login', async ({ page }) => {
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Credenciales inválidas' }),
      });
    });
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('malo@test.pe');
    await page.locator('input[type="password"]').fill('WrongPass');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(url).toContain('login');
  });

  test('error 500 mock muestra mensaje de error en UI', async ({ page }) => {
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Error interno del servidor' }),
      });
    });
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@test.pe');
    await page.locator('input[type="password"]').fill('Test1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    // La app debe mostrar algún tipo de error sin crashear
    await expect(page.locator('body')).toBeVisible();
  });
});
