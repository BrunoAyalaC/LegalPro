/**
 * Playwright config para E2E de PRODUCCIÓN REAL
 * ─────────────────────────────────────────────────────────────────────────────
 * Ejecutar con: npm run test:prod:e2e
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Solo el spec de producción
  testDir: './e2e',
  testMatch: ['**/produccion.spec.js'],
  // Más tiempo para Railway (cold starts, latencia real)
  timeout: 60000,
  retries: 1, // 1 retry para flakiness de red
  use: {
    // Frontend desplegado en Railway
    baseURL: 'https://legalpro-frontend-production.up.railway.app',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // Video en fallo para debugging de producción
    video: 'on-first-retry',
    // Simular usuario real
    locale: 'es-PE',
    timezoneId: 'America/Lima',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  // Sin webServer — usamos el de producción real
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-prod' }]],
});
