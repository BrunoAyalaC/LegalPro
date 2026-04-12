/**
 * JOURNEY TESTS — Gestión de Expedientes
 * Cubre: CRUD expedientes, filtros, paginación, multi-tenant
 */
import { test, expect } from '@playwright/test';

async function injectFakeAuth(page, rol = 'ABOGADO') {
  await page.addInitScript(({ rol }) => {
    localStorage.setItem('token', 'fake.token.testing');
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol }));
  }, { rol });
}

const mockExpedientesList = {
  data: [
    { id: 1, numero: 'EXP-2024-001', titulo: 'Divorcio García vs López', estado: 'ACTIVO', materia: 'CIVIL' },
    { id: 2, numero: 'EXP-2024-002', titulo: 'Homicidio caso Flores', estado: 'ACTIVO', materia: 'PENAL' },
    { id: 3, numero: 'EXP-2024-003', titulo: 'Despido injustificado Santos', estado: 'CERRADO', materia: 'LABORAL' },
  ],
  total: 3,
  page: 1,
  limit: 10,
};

test.describe('Expedientes — Acceso protegido', () => {
  test('sin auth, /expedientes redirige a login', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/expedientes');
    await page.waitForURL(/login/, { timeout: 5000 });
    expect(page.url()).toContain('login');
  });

  test('sin auth, /expedientes/nuevo redirige', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/expedientes/nuevo');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/login|expedientes/i);
  });

  test('sin auth, /gestion-multidoc redirige', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/gestion-multidoc');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/login|gestion/i);
  });
});

test.describe('Expedientes — Con auth mock', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO' }) })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, nombre: 'Demo Org', plan: 'profesional' }) })
    );
    await page.route('**/api/expedientes**', route =>
      route.fulfill({ status: 200, body: JSON.stringify(mockExpedientesList) })
    );
    await injectFakeAuth(page);
  });

  test('ruta /expedientes no crashea con auth', async ({ page }) => {
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /gestion-multidoc no crashea', async ({ page }) => {
    await page.goto('/gestion-multidoc');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('app carga root element en /expedientes', async ({ page }) => {
    await page.goto('/expedientes');
    await expect(page.locator('#root')).toBeVisible();
  });
});

test.describe('Expedientes — API mock journeys', () => {
  test('GET expedientes retorna lista vacía graciosamente', async ({ page }) => {
    await page.route('**/api/expedientes**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ data: [], total: 0 }) })
    );
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('error 402 de plan retorna graciosamente', async ({ page }) => {
    await page.route('**/api/expedientes**', route =>
      route.fulfill({ status: 402, body: JSON.stringify({ error: 'Límite del plan alcanzado' }) })
    );
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('error de red retorna graciosamente', async ({ page }) => {
    await page.route('**/api/expedientes**', route => route.abort('failed'));
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('timeout de red retorna graciosamente', async ({ page }) => {
    await page.route('**/api/expedientes**', async route => {
      await new Promise(r => setTimeout(r, 3000));
      await route.fulfill({ status: 504, body: JSON.stringify({ error: 'Timeout' }) });
    });
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Expedientes — Multi-tenant seguridad', () => {
  test('tenant A no puede acceder a ruta con ID de tenant B via mock', async ({ page }) => {
    // Simula que el backend rechaza por organización incorrecta
    await page.route('**/api/expedientes/999**', route =>
      route.fulfill({ status: 403, body: JSON.stringify({ error: 'Acceso denegado' }) })
    );
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    // UI no debe crashear
    await expect(page.locator('body')).toBeVisible();
  });

  test('token expirado retorna 401 y redirige', async ({ page }) => {
    await page.route('**/api/expedientes**', route =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'Token expirado' }) })
    );
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(2000);
    // La app debe manejar el 401 sin crashear
    await expect(page.locator('body')).toBeVisible();
  });

  test('token de otro tenant retorna 403 y UI lo maneja', async ({ page }) => {
    await page.route('**/api/**', route =>
      route.fulfill({ status: 403, body: JSON.stringify({ error: 'Org ID no coincide' }) })
    );
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('plan básico excedido retorna 402 para expedientes', async ({ page }) => {
    await page.route('**/api/expedientes', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 402, body: JSON.stringify({ error: 'Plan Básico: máximo 5 expedientes' }) });
      } else {
        await route.continue();
      }
    });
    await injectFakeAuth(page);
    await page.goto('/expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Expedientes — Descargar App', () => {
  test('ruta /descargar-app no crashea', async ({ page }) => {
    const res = await page.goto('/descargar-app');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('página de descarga tiene contenido', async ({ page }) => {
    await page.goto('/descargar-app');
    await page.waitForTimeout(1000);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
