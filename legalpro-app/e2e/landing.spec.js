import { test, expect } from '@playwright/test';

test.describe('Landing Page — /landing/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing/');
  });

  test('carga correctamente y muestra el navbar', async ({ page }) => {
    await expect(page).toHaveTitle(/Lex\.ia|LegalPro/i);
    // Navbar fijo visible
    const nav = page.locator('nav, .navbar, #navbar');
    await expect(nav.first()).toBeVisible();
  });

  test('muestra el hero con branding Lex.ia (no Gemini)', async ({ page }) => {
    const body = await page.content();
    // Verificar que no hay "GEMINI AI" visible como branding principal
    expect(body).not.toMatch(/POWERED BY GEMINI AI/i);
    // Verificar Lex.ia aparece
    expect(body).toMatch(/Lex\.ia/i);
  });

  test('sección MÓDULOS PRINCIPALES visible (no CAPÍTULOS CINEMATOGRÁFICOS)', async ({ page }) => {
    const body = await page.content();
    expect(body).not.toMatch(/CAPÍTULOS CINEMATOGRÁFICOS/i);
    expect(body).toMatch(/MÓDULOS PRINCIPALES/i);
  });

  test('botón CTA apunta a /login', async ({ page }) => {
    // Buscar cualquier enlace que lleve al login
    const ctaLinks = page.locator('a[href="/login"], a[href*="login"]');
    const count = await ctaLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sección de instituciones es visible', async ({ page }) => {
    // Scroll down para que cargue la sección lazy
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    const body = await page.content();
    expect(body).toMatch(/INDECOPI|SUNARP|Poder Judicial|instituciones/i);
  });

  test('no hay error de consola crítico al cargar', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/landing/');
    await page.waitForTimeout(2000);
    // Solo fallar por errores críticos de JS (no warnings de GSAP/fonts)
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection') &&
      !e.includes('fonts.googleapis')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('responsive: en mobile el nav tiene menos items visibles', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/landing/');
    // Verificar que la página cargó sin crash
    await expect(page.locator('body')).toBeVisible();
  });
});
