import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'e2e', '.auth', 'abogado.json');

/** E2E exhaustivo contra producción Railway (frontend + Node API reales). */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/exhaustive-produccion.spec.js', '**/produccion-real.spec.js'],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-prod-exhaustive' }]],
  use: {
    baseURL: process.env.E2E_FRONTEND_URL || 'https://legalpro-frontend-production-a988.up.railway.app',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.mjs/ },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.mjs/,
    },
  ],
});
