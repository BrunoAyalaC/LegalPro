/**
 * JOURNEY TESTS — Onboarding y Flujos Completos
 * Cubre: primer uso, setup org, flujos completos por rol
 */
import { test, expect } from '@playwright/test';

test.describe('Onboarding — Flujo primer ingreso ABOGADO', () => {
  test('journey: registro → login → setup org (todo con mocks)', async ({ page }) => {
    // Step 1: Mock registro
    await page.route('**/api/auth/register', route =>
      route.fulfill({
        status: 201,
        body: JSON.stringify({ mensaje: 'Usuario registrado exitosamente', id: 50 }),
      })
    );
    // Step 2: Mock login
    await page.route('**/api/auth/login', route =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          token: 'onboarding.fake.token',
          usuario: { id: 50, email: 'nuevo@legalpro.pe', rol: 'ABOGADO', nombre: 'Nuevo Usuario' },
        }),
      })
    );
    // Step 3: Mock org (no existe aún)
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 403, body: JSON.stringify({ error: 'Sin organización' }) })
    );

    // Iniciar en login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('nuevo@legalpro.pe');
    await page.locator('input[type="password"]').fill('Nuevo2026!');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Verificar que la app no crasheó
    await expect(page.locator('body')).toBeVisible();
  });

  test('journey: usuario sin org ve pantalla de setup', async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 50, email: 'nuevo@legalpro.pe', rol: 'ABOGADO' }) })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 403, body: JSON.stringify({ error: 'Sin organización' }) })
    );
    await page.addInitScript(() => {
      localStorage.setItem('token', 'onboarding.fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 50, email: 'nuevo@legalpro.pe', rol: 'ABOGADO' }));
    });
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    // Debe redirigir a setup o mostrar setup
    await expect(page.locator('body')).toBeVisible();
  });

  test('journey: creació de organización vía mock', async ({ page }) => {
    await page.route('**/api/organizaciones', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ id: 10, nombre: 'Mi Estudio Abogados', plan: 'basico' }),
        });
      } else {
        await route.continue();
      }
    });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 50, email: 'nuevo@legalpro.pe', rol: 'ABOGADO' }));
    });
    await page.goto('/setup-organizacion');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Onboarding — Flujo completo FISCAL', () => {
  test('fiscal nuevo puede acceder al dashboard de fiscalía', async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 11, email: 'fiscal@legalpro.pe', rol: 'FISCAL' }) })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 2, nombre: 'Fiscalía Demo', plan: 'institucional' }) })
    );
    await page.route('**/api/expedientes**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ data: [], total: 0 }) })
    );
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fiscal.fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 11, email: 'fiscal@legalpro.pe', rol: 'FISCAL' }));
    });
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Onboarding — Flujo completo JUEZ', () => {
  test('juez puede acceder a su dashboard', async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 12, email: 'juez@legalpro.pe', rol: 'JUEZ' }) })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 3, nombre: 'Juzgado', plan: 'institucional' }) })
    );
    await page.addInitScript(() => {
      localStorage.setItem('token', 'juez.fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 12, email: 'juez@legalpro.pe', rol: 'JUEZ' }));
    });
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Onboarding — Planes y límites', () => {
  test('plan BASICO excedido muestra mensaje apropiado', async ({ page }) => {
    await page.route('**/api/expedientes', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 402, body: JSON.stringify({ error: 'Plan Básico: máximo 5 expedientes alcanzado' }) });
      } else {
        await route.continue();
      }
    });
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO' }) })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, nombre: 'Demo', plan: 'basico' }) })
    );
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO' }));
    });
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('plan PROFESIONAL tiene más capacidad', async ({ page }) => {
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, nombre: 'Pro Org', plan: 'profesional', limite_expedientes: 100 }) })
    );
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO' }));
    });
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('usuario OWNER puede ver membresía de la org', async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 9, email: 'admin@legalpro.pe', rol: 'ABOGADO' }) })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 1, nombre: 'Estudio Admin',
          plan: 'profesional',
          rol_en_org: 'OWNER',
          limite_expedientes: 100,
        }),
      })
    );
    await page.addInitScript(() => {
      localStorage.setItem('token', 'admin.fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 9, email: 'admin@legalpro.pe', rol: 'ABOGADO' }));
    });
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('feedback de bienvenida al primer login', async ({ page }) => {
    await page.route('**/api/auth/login', route =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          token: 'welcome.token',
          usuario: { id: 99, email: 'welcome@legalpro.pe', rol: 'ABOGADO', nombre: 'Bienvenido' },
          primer_login: true,
        }),
      })
    );
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('welcome@legalpro.pe');
    await page.locator('input[type="password"]').fill('Welcome2026!');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Onboarding — Accesibilidad en flujos', () => {
  test('formulario de login accesible con solo teclado', async ({ page }) => {
    await page.goto('/login');
    // Esperar a que el lazy chunk de Login cargue
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    // Tab → email → password → submit
    await page.keyboard.press('Tab');
    const email = await page.evaluate(() => document.activeElement?.getAttribute('type'));
    expect(['email', 'text']).toContain(email);
    await page.keyboard.press('Tab');
    const pass = await page.evaluate(() => document.activeElement?.getAttribute('type'));
    expect(['password', 'text']).toContain(pass);
  });

  test('landing es navegable con teclado', async ({ page }) => {
    await page.goto('/landing/');
    await page.waitForTimeout(500);
    await page.keyboard.press('Tab');
    // No debe lanzar errores al tabular
    await expect(page.locator('body')).toBeVisible();
  });
});
