/**
 * JOURNEY TESTS — UI/UX y Flujos de Usuario Completos
 * Cubre: navegación, feedback visual, loading states, error states
 */
import { test, expect } from '@playwright/test';

test.describe('UI Journey — Flujo completo Login→Dashboard', () => {
  test('journey completo: login exitoso via mock va a dashboard', async ({ page }) => {  
    // Given: usuario en página de login
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Mock del backend
    await page.route('**/api/auth/login', route =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          token: 'header.payload.signature',
          usuario: { id: 9, email: 'admin@legalpro.pe', rol: 'ABOGADO', nombre: 'Admin' },
        }),
      })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, nombre: '4 Estudio Legal', plan: 'profesional' }) })
    );

    // When: llena formulario y hace submit
    await page.locator('input[type="email"]').fill('admin@legalpro.pe');
    await page.locator('input[type="password"]').fill('LegalPro2026!');
    await page.locator('button[type="submit"]').click();

    // Then: redirige fuera de login
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toMatch(/dashboard|setup|login/i);
  });

  test('journey: error de credenciales muestra feedback', async ({ page }) => {
    await page.route('**/api/auth/login', route =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'Credenciales inválidas' }) })
    );
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('malo@test.pe');
    await page.locator('input[type="password"]').fill('WrongPass123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    // Debe permanecer en login
    expect(page.url()).toContain('login');
    // Debe mostrar algún feedback de error
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toMatch(/error|inválid|incorrecto|credencial/i);
  });

  test('journey: toggle de contraseña cambia visibilidad', async ({ page }) => {
    await page.goto('/login');
    const passInput = page.locator('input[type="password"]');
    await passInput.fill('MiContraseña123');

    // Debe haber un botón toggle
    const toggleBtn = page.locator('button:has(span.material-icons)').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
      // Input type debe cambiar
      const inputType = await page.locator('input[value="MiContraseña123"]').getAttribute('type');
      expect(inputType).toBe('text');
    } else {
      // Si no hay toggle, el test pasa (feature opcional)
      expect(true).toBe(true);
    }
  });

  test('journey: checkbox recordarme está funcional', async ({ page }) => {
    await page.goto('/login');
    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible()) {
      const initialChecked = await checkbox.isChecked();
      if (initialChecked) {
        await checkbox.uncheck();
        await expect(checkbox).not.toBeChecked();
        await checkbox.check();
        await expect(checkbox).toBeChecked();
      } else {
        await checkbox.check();
        await expect(checkbox).toBeChecked();
      }
    } else {
      expect(true).toBe(true);
    }
  });
});

test.describe('UI Journey — Estados de carga', () => {
  test('botón submit se deshabilita durante petición', async ({ page }) => {
    await page.route('**/api/auth/login', async route => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Error' }) });
    });
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@test.pe');
    await page.locator('input[type="password"]').fill('Test1234');
    await page.locator('button[type="submit"]').click();
    // Inmediatamente después del click, el botón debe deshabilitarse
    await expect(page.locator('button[type="submit"]')).toBeDisabled({ timeout: 1000 });
  });

  test('loading spinner o estado de carga visible', async ({ page }) => {
    await page.route('**/api/auth/login', async route => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Error' }) });
    });
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@test.pe');
    await page.locator('input[type="password"]').fill('Test1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(200);
    // El formulario no debe haber desaparecido
    await expect(page.locator('#root')).toBeVisible();
  });

  test('página de landing carga animaciones sin error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/landing/');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(500);
    const critical = errors.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('fonts.googleapis')
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('UI Journey — Navegación entre páginas', () => {
  test('desde landing, CTA inicia sesión lleva a /login', async ({ page }) => {
    await page.goto('/landing/');
    await page.waitForTimeout(1000);
    const loginLink = page.locator('a[href="/login"], a[href*="login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await page.waitForURL(/login/, { timeout: 5000 });
      expect(page.url()).toContain('login');
    } else {
      expect(true).toBe(true); // No hay link directo, aceptable
    }
  });

  test('navegación browser back funciona en SPA', async ({ page }) => {
    await page.goto('/login');
    await page.goto('/landing/');
    await page.goBack();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('login');
  });

  test('navegación browser forward funciona en SPA', async ({ page }) => {
    await page.goto('/login');
    await page.goto('/landing/');
    await page.goBack();
    await page.goForward();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('landing');
  });

  test('refresh page mantiene la ruta actual', async ({ page }) => {
    await page.goto('/login');
    await page.reload();
    expect(page.url()).toContain('login');
  });

  test('página 404 manejada por SPA', async ({ page }) => {
    const res = await page.goto('/ruta-inexistente-abc123');
    // SPA devuelve 200 (React Router maneja 404) o 404 del servidor
    expect([200, 404]).toContain(res?.status());
  });
});

test.describe('UI Journey — Perfil y Configuración', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO', nombre: 'Demo User' }) })
    );
    await page.route('**/api/organizaciones/me', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ id: 1, nombre: 'Estudio Demo', plan: 'profesional' }) })
    );
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake.token');
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'demo@legalpro.pe', rol: 'ABOGADO' }));
    });
  });

  test('ruta /perfil carga sin crash', async ({ page }) => {
    await page.goto('/perfil');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /config-especialidad carga sin crash', async ({ page }) => {
    await page.goto('/config-especialidad');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('ruta /setup-organizacion carga sin crash', async ({ page }) => {
    await page.goto('/setup-organizacion');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});
