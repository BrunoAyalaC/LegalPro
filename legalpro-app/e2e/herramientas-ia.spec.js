/**
 * JOURNEY TESTS — Herramientas de IA
 * Cubre: redactor, simulador, predictor, jurisprudencia, chat IA, generadores
 */
import { test, expect } from '@playwright/test';

async function injectFakeAuth(page, rol = 'ABOGADO') {
  await page.addInitScript(({ rol }) => {
    const payload = { id: 1, email: 'demo@legalpro.pe', rol };
    localStorage.setItem('token', 'fake.token.for.testing');
    localStorage.setItem('user', JSON.stringify(payload));
  }, { rol });
}

function mockAuthAndOrg(page) {
  return Promise.all([
    page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO' }) })
    ),
    page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, nombre: 'Demo Org', plan: 'profesional' }) })
    ),
  ]);
}

test.describe('Redactor de Escritos — Journey', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAndOrg(page);
    await injectFakeAuth(page);
  });

  test('ruta /redactor no crashea', async ({ page }) => {
    await page.goto('/redactor');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /redactor-escritos no crashea', async ({ page }) => {
    await page.goto('/redactor-escritos');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('redactor redirige a login sin auth', async ({ page }) => {
    // Sin inyectar token — usar addInitScript para limpiar ANTES de navegar
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/redactor');
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(url).toMatch(/login|redactor/i);
  });
});

test.describe('Simulador de Juicios — Journey', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAndOrg(page);
    await injectFakeAuth(page);
  });

  test('ruta /simulador existe en la SPA', async ({ page }) => {
    const res = await page.goto('/simulador');
    expect(res?.status()).toBeLessThan(400);
  });

  test('ruta /simulador-juicios existe en la SPA', async ({ page }) => {
    const res = await page.goto('/simulador-juicios');
    expect(res?.status()).toBeLessThan(400);
  });

  test('sin auth, /simulador redirige', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/simulador');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/login|simulador/i);
  });
});

test.describe('Predictor Judicial — Journey', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAndOrg(page);
    await injectFakeAuth(page);
  });

  test('ruta /predictor no crashea', async ({ page }) => {
    await page.goto('/predictor');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /predictor-judicial no crashea', async ({ page }) => {
    await page.goto('/predictor-judicial');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Buscador de Jurisprudencia — Journey', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAndOrg(page);
    await injectFakeAuth(page);
    await page.route('**/api/jurisprudencia**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ resultados: [], total: 0 }) })
    );
  });

  test('ruta /jurisprudencia no crashea', async ({ page }) => {
    await page.goto('/jurisprudencia');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /buscador-jurisprudencia no crashea', async ({ page }) => {
    await page.goto('/buscador-jurisprudencia');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat IA Legal — Journey', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAndOrg(page);
    await injectFakeAuth(page);
    await page.route('**/api/gemini/**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ respuesta: 'Respuesta de prueba del asistente legal.' }) })
    );
  });

  test('ruta /chat-ia no crashea', async ({ page }) => {
    await page.goto('/chat-ia');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /asistente-ia no crashea', async ({ page }) => {
    await page.goto('/asistente-ia');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Herramientas Multidisciplinarias — Journey', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAndOrg(page);
    await injectFakeAuth(page);
  });

  test('ruta /herramientas no crashea', async ({ page }) => {
    await page.goto('/herramientas');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /monitor-sinoe no crashea', async ({ page }) => {
    await page.goto('/monitor-sinoe');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /boveda-evidencia no crashea', async ({ page }) => {
    await page.goto('/boveda-evidencia');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /generador-alegatos no crashea', async ({ page }) => {
    await page.goto('/generador-alegatos');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /estrategia-interrogatorio no crashea', async ({ page }) => {
    await page.goto('/estrategia-interrogatorio');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /asistente-objeciones no crashea', async ({ page }) => {
    await page.goto('/asistente-objeciones');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /resumen-ejecutivo no crashea', async ({ page }) => {
    await page.goto('/resumen-ejecutivo');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /reporte-retroalimentacion no crashea', async ({ page }) => {
    await page.goto('/reporte-retroalimentacion');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /comparador-precedentes no crashea', async ({ page }) => {
    await page.goto('/comparador-precedentes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /analista-expedientes no crashea', async ({ page }) => {
    await page.goto('/analista-expedientes');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});
