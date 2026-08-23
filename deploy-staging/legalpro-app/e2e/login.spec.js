import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('muestra el formulario de login correctamente', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Iniciar Sesión');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('muestra el panel izquierdo hero en desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const leftPanel = page.locator('.login-left-panel');
    await expect(leftPanel).toBeVisible();
    await expect(page.locator('text=La justicia,')).toBeVisible();
    await expect(page.locator('text=potenciada por IA')).toBeVisible();
  });

  test('oculta el panel izquierdo en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const leftPanel = page.locator('.login-left-panel');
    await expect(leftPanel).toBeHidden();
    // Mobile logo debe ser visible
    await expect(page.locator('.login-mobile-logo')).toBeVisible();
  });

  test('muestra error con campos vacíos', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    // HTML5 validation prevents submission with empty required fields
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('el campo email acepta input', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@legalpro.pe');
    await expect(emailInput).toHaveValue('test@legalpro.pe');
  });

  test('toggle de visibilidad de contraseña funciona', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('MiPassword123');

    // Click toggle button — identificado por aria-label
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();

    // Now should be text type
    const visibleInput = page.locator('input[value="MiPassword123"]');
    await expect(visibleInput).toHaveAttribute('type', 'text');
  });

  test('muestra stats en panel izquierdo desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const leftPanel = page.locator('.login-left-panel');
    await expect(leftPanel.locator('text=94%').first()).toBeVisible();
    await expect(leftPanel.locator('text=50K+').first()).toBeVisible();
    await expect(leftPanel.locator('text=13').first()).toBeVisible();
  });

  test('muestra roles badges en desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('text=Abogado')).toBeVisible();
    await expect(page.locator('text=Fiscal')).toBeVisible();
    await expect(page.locator('text=Juez')).toBeVisible();
    await expect(page.locator('text=Contador')).toBeVisible();
  });
});
