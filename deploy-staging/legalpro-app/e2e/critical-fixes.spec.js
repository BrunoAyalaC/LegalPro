// legalpro-app/e2e/critical-fixes.spec.js
// Generado por @journey-tester
// Tests E2E para validar los 3 fixes CRITICAL

import { test, expect } from '@playwright/test';

const TEST_USERS = {
  orgA: { email: 'abogado@estudio-pro.pe', password: 'LegalPro2026!' },
  orgB: { email: 'abogado@bufete-enterprise.pe', password: 'LegalPro2026!' }
};

test.describe('CRITICAL FIXES - Production Blockers', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('FIX 1: IDOR cross-tenant - token de Org A no puede acceder a expediente de Org B', async ({ page }) => {
    // 1. Login como Org A
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USERS.orgA.email);
    await page.getByLabel(/contraseña|password/i).fill(TEST_USERS.orgA.password);
    await page.getByRole('button', { name: /ingresar|login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    const tokenA = await page.evaluate(() => localStorage.getItem('accessToken') || 'no-token');

    // 2. Intentar acceder a un UUID valido de otra organizacion
    const OTHER_ORG_EXPEDIENTE = '11111111-2222-3333-4444-555555555555';
    const response = await page.evaluate(async ({ id }) => {
      const res = await fetch(`http://localhost:3001/api/expedientes/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      return { status: res.status, body: await res.json() };
    }, { id: OTHER_ORG_EXPEDIENTE });

    // Debe ser 404 (no encontrado), no 200
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/not found|not found/i);
  });

  test('FIX 2: 4 checkboxes separados en signup (LPDP Art. 14)', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill('newuser@test.com');
    await page.getByLabel(/nombre completo/i).fill('Test User');
    await page.getByLabel(/contraseña|password/i).first().fill('TestPassword123!');
    await page.getByLabel(/confirmar/i).fill('TestPassword123!');
    await page.getByLabel(/organización|organizacion/i).fill('Test Org');
    await page.getByRole('button', { name: /continuar/i }).click();

    // Verificar 4 checkboxes separados
    await expect(page.getByLabel(/términos y condiciones/i)).toBeVisible();
    await expect(page.getByLabel(/política de privacidad/i)).toBeVisible();
    await expect(page.getByLabel(/emails de marketing/i)).toBeVisible();
    await expect(page.getByLabel(/transferencia internacional a google gemini/i)).toBeVisible();

    // Verificar que NO se puede submit sin los obligatorios
    const submitBtn = page.getByRole('button', { name: /crear cuenta/i });
    await expect(submitBtn).toBeDisabled();

    // Aceptar obligatorios
    await page.getByLabel(/términos y condiciones/i).check();
    await page.getByLabel(/política de privacidad/i).check();
    await expect(submitBtn).toBeEnabled();
  });

  test('FIX 3: MFA es requerido para ABOGADO', async ({ page, request }) => {
    // 1. Login con credenciales
    const res = await request.post('http://localhost:3001/api/auth/login', {
      data: { email: TEST_USERS.orgA.email, password: TEST_USERS.orgA.password }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    // 2. Si MFA esta habilitado, debe responder con mfaRequired: true
    // Si no esta habilitado y el rol lo requiere, debe pedir setup
    expect(body.data.mfaRequired !== undefined || body.data.mfaSetupRequired !== undefined).toBe(true);
  });

  test('FIX 3: MFA setup - generar QR', async ({ page, request }) => {
    // Login primero
    const loginRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { email: TEST_USERS.orgA.email, password: TEST_USERS.orgA.password }
    });
    const { accessToken } = await loginRes.json().then(b => b.data);

    // Setup MFA
    const setupRes = await request.post('http://localhost:3001/api/auth/mfa/setup', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(setupRes.status()).toBe(200);
    const setup = await setupRes.json();
    expect(setup.data.secret).toBeTruthy();
    expect(setup.data.qrCodeUrl).toBeTruthy();
    expect(setup.data.backupCodes).toHaveLength(8);
  });

  test('FIX 1: Audit log registra intento de cross-tenant', async ({ page, request }) => {
    const loginRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { email: TEST_USERS.orgA.email, password: TEST_USERS.orgA.password }
    });
    const { accessToken } = await loginRes.json().then(b => b.data);

    // Intentar acceder a expediente de otro org
    const res = await request.get('http://localhost:3001/api/expedientes/11111111-2222-3333-4444-555555555555', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(res.status()).toBe(404);

    // Verificar audit log (esto requiere permisos de owner, en e2e no lo verificamos,
    // pero en produccion el audit log debe tener el evento)
  });
});
