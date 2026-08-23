import { defineConfig } from '@playwright/test';

/**
 * Configuración E2E de INTEGRACIÓN REAL contra el stack docker-compose.
 *   Frontend (nginx)  : http://localhost:3000
 *   Backend Node API  : http://localhost:3001
 *
 * A diferencia de playwright.config.js (mocks + vite preview), esta config NO mockea:
 * ejercita login real, BD real (seed) e interacciones reales.
 *
 * Uso:
 *   npx playwright test --config=playwright.config.e2e.js
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/produccion-real.spec.js'],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-e2e' }]],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
