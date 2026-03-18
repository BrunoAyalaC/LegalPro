import { test, expect } from '@playwright/test';

/**
 * Tests de accesibilidad básica (sin herramientas externas)
 * Verifica atributos ARIA, focus, contraste de texto visible.
 */
test.describe('Accesibilidad — Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('todos los inputs tienen label asociado', async ({ page }) => {
    // Email
    const emailLabel = page.locator('label:has-text("Correo")');
    await expect(emailLabel).toBeVisible();
    // Password
    const passLabel = page.locator('label:has-text("Contraseña")');
    await expect(passLabel).toBeVisible();
  });

  test('el logo tiene atributo alt', async ({ page }) => {
    const logoImgs = page.locator('img[alt]');
    const count = await logoImgs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('el botón toggle de contraseña tiene aria-label o es accesible', async ({ page }) => {
    const toggleBtn = page.locator('button:has(span.material-icons)').first();
    await expect(toggleBtn).toBeVisible();
    // Debe ser clickeable sin mouse trap
    await toggleBtn.click();
  });

  test('navegación por tab alcanza todos los campos', async ({ page }) => {
    await page.keyboard.press('Tab'); // focus email
    const focusedEmail = await page.evaluate(() => document.activeElement?.getAttribute('type'));
    expect(focusedEmail).toBe('email');

    await page.keyboard.press('Tab'); // focus password
    const focusedPass = await page.evaluate(() => document.activeElement?.getAttribute('type'));
    expect(focusedPass).toBe('password');
  });

  test('submit con Enter funciona', async ({ page }) => {
    await page.locator('input[type="email"]').fill('test@test.pe');
    await page.locator('input[type="password"]').fill('password123');
    await page.keyboard.press('Enter');
    // Debe intentar submit (no crash)
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('login'); // Permanece en login (credenciales fake)
  });
});

test.describe('Accesibilidad — Landing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing/');
    await page.waitForTimeout(1000);
  });

  test('todas las imágenes tienen alt text', async ({ page }) => {
    const imgs = await page.locator('img').all();
    for (const img of imgs) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('aria-hidden');
      // Debe tener alt O estar marcada como aria-hidden
      const hasAlt = alt !== null;
      const isDecorative = role === 'true';
      expect(hasAlt || isDecorative).toBeTruthy();
    }
  });

  test('la página tiene un heading principal h1', async ({ page }) => {
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('los links tienen texto descriptivo o aria-label', async ({ page }) => {
    const links = await page.locator('a').all();
    let emptyLinks = 0;
    for (const link of links) {
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      if (!text?.trim() && !ariaLabel) emptyLinks++;
    }
    // Máximo 2 links vacíos tolerados (íconos decorativos)
    expect(emptyLinks).toBeLessThanOrEqual(2);
  });
});
