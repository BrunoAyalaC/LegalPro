import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/ai-features.spec.js', '**/accessibility.spec.js', '**/resilience.spec.js'],
  timeout: 120000,
  retries: 1,
  use: { baseURL: 'https://legalpro-frontend-production-a988.up.railway.app', headless: true, screenshot: 'on', video: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
