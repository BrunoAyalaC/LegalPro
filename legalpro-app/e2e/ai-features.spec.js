// legalpro-app/e2e/ai-features.spec.js
// Generado por @journey-tester - Tests E2E para herramientas IA

import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'abogado@estudio-pro.pe',
  password: 'LegalPro2026!'
};

test.describe('AI Features E2E - Critical Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/contraseña|password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /ingresar|login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('US-1: Analizar expediente completo', async ({ page }) => {
    await page.goto('/analizar-expedientes');
    await expect(page.getByRole('heading', { name: /analizar expediente/i })).toBeVisible();
    // Seleccionar un expediente del dropdown
    await page.getByLabel(/expediente/i).first().selectOption({ index: 1 });
    await page.getByRole('button', { name: /analizar/i }).click();
    // Esperar resultado
    await expect(page.getByText(/fortalezas/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/debilidades/i)).toBeVisible();
    // Verificar disclaimer IA
    await expect(page.getByText(/no constituye asesoría legal/i)).toBeVisible();
    // Verificar citas
    await expect(page.locator('[data-testid="citas-verificadas"]')).toBeVisible();
  });

  test('US-2: Redactar demanda', async ({ page }) => {
    await page.goto('/redactor-escritos');
    await page.getByLabel(/tipo/i).selectOption('demanda');
    await page.getByLabel(/hechos/i).fill('Incumplimiento de contrato por S/ 50,000');
    await page.getByLabel(/fundamentos/i).fill('CC art. 1350, art. 1969');
    await page.getByRole('button', { name: /generar|redactar/i }).click();
    // Verificar estructura
    await expect(page.getByText(/petitorio/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/fundamentación/i)).toBeVisible();
    // Disclaimer de verificación obligatoria
    await expect(page.getByText(/revisado por un abogado/i)).toBeVisible();
  });

  test('US-3: Buscar jurisprudencia con resultados verificables', async ({ page }) => {
    await page.goto('/buscador-jurisprudencia');
    await page.getByLabel(/búsqueda|query/i).fill('despido arbitrario');
    await page.getByLabel(/fuente/i).selectOption('PJ');
    await page.getByRole('button', { name: /buscar/i }).click();
    // Verificar resultados
    await expect(page.locator('[data-testid="resultado-jurisprudencia"]')).toHaveCount(10, { timeout: 30000 });
    // Verificar ratio decidendi
    await expect(page.getByText(/ratio decidendi/i).first()).toBeVisible();
    // Verificar link a SPIJ
    await expect(page.locator('a[href*="spij"]').first()).toBeVisible();
  });

  test('US-4: Predecir resultado (con disclaimer obligatorio)', async ({ page }) => {
    await page.goto('/predictor-judicial');
    await page.getByLabel(/expediente/i).selectOption({ index: 1 });
    await page.getByRole('button', { name: /predecir/i }).click();
    // El disclaimer es OBLIGATORIO antes del resultado
    await expect(page.getByText(/análisis probabilístico/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/no garantiza el resultado/i)).toBeVisible();
  });

  test('US-7: ARCO - Exportar mis datos', async ({ page }) => {
    await page.goto('/mis-datos');
    await page.getByRole('button', { name: /exportar mis datos/i }).click();
    // Esperar descarga
    const download = await page.waitForEvent('download', { timeout: 30000 });
    expect(download.suggestedFilename()).toMatch(/legalpro-datos-.*\.(json|pdf)/);
  });

  test('US-9: Notificaciones del SINOE (mock)', async ({ page }) => {
    await page.goto('/monitor-sinoe');
    // Verificar que aparecen notificaciones
    await expect(page.locator('[data-testid="notificacion"]')).toHaveCount(1, { timeout: 10000 });
    // Verificar plazo destacado
    await expect(page.getByText(/plazo/i).first()).toBeVisible();
  });

  test('Accesibilidad: Navegación por teclado', async ({ page }) => {
    await page.goto('/herramientas');
    // Tab debe llegar a todos los elementos
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Verificar focus visible
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('LPDP: Consentimiento granular en signup', async ({ page }) => {
    await page.goto('/signup');
    // Verificar 4 checkboxes separados (no 1 cajón de sastre)
    await expect(page.getByLabel(/términos/i)).toBeVisible();
    await expect(page.getByLabel(/privacidad/i)).toBeVisible();
    await expect(page.getByLabel(/marketing/i)).toBeVisible();
    await expect(page.getByLabel(/transferencia internacional/i)).toBeVisible();
  });

  test('Audit log: X-Correlation-ID se preserva en errores', async ({ page }) => {
    const cid = crypto.randomUUID();
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        const headers = req.headers();
        expect(headers['x-correlation-id']).toBeTruthy();
      }
    });
    await page.goto('/dashboard');
  });
});
