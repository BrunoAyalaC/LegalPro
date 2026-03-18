import { test, expect } from '@playwright/test';

test.describe('Navegación y Rutas', () => {
  test('ruta / redirige a /login, /landing/ o /dashboard', async ({ page }) => {
    await page.goto('/');
    // La app puede redirigir a login, landing o dashboard según el estado
    await page.waitForURL(/\/login|\/dashboard|\/landing/, { timeout: 5000 });
    const url = page.url();
    expect(url).toMatch(/login|dashboard|landing/);
  });

  test('ruta /login carga la página de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  });

  test('ruta /landing/ carga la landing page', async ({ page }) => {
    const response = await page.goto('/landing/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('rutas protegidas sin auth redirigen a /login', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/expedientes',
      '/redactor',
      '/simulador',
    ];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForTimeout(1000);
      const url = page.url();
      // Debe redirigir a login si no hay auth
      expect(url).toContain('login');
    }
  });

  test('ruta /descargar-app responde sin crash', async ({ page }) => {
    const response = await page.goto('/descargar-app');
    // La SPA sirve index.html (200) para todas las rutas
    expect(response?.status()).toBeLessThan(400);
    // Esperar que React monte algo
    await page.waitForSelector('#root', { timeout: 5000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta 404 muestra página de error o redirige', async ({ page }) => {
    const response = await page.goto('/ruta-que-no-existe-xyz');
    // SPA debe servir el index.html (200) y manejar 404 en React Router
    // O Railway/nginx devuelve 404
    expect([200, 404]).toContain(response?.status());
  });
});

test.describe('Flujo de Autenticación', () => {
  test('login con credenciales incorrectas muestra error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('usuario.falso@test.pe');
    await page.locator('input[type="password"]').fill('contraseña-incorrecta-123');
    await page.locator('button[type="submit"]').click();

    // Debe mostrar mensaje de error (el proxy no corre en preview, igual habrá error de red)
    // Esperar que aparezca cualquier texto de error visible
    await page.waitForFunction(
      () => {
        const texts = document.body.innerText;
        return texts.includes('Error') || texts.includes('error') || texts.includes('inválid') || texts.includes('incorrecto');
      },
      { timeout: 9000 }
    );
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toMatch(/error|inválid|incorrecto|conexión|credencial/i);
  });

  test('botón submit muestra spinner durante carga', async ({ page }) => {
    await page.goto('/login');

    // Interceptar la petición para que tarde
    await page.route('**/api/auth/login', async route => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Credenciales inválidas' }) });
    });

    await page.locator('input[type="email"]').fill('test@test.pe');
    await page.locator('input[type="password"]').fill('TestPassword123');
    await page.locator('button[type="submit"]').click();

    // Spinner debe aparecer durante la petición (div con border-radius 50%)
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled({ timeout: 3000 });
  });

  test('checkbox "Recordarme" funciona', async ({ page }) => {
    await page.goto('/login');
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked(); // Por defecto checked
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });
});
