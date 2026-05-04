import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/__tests__/**/*.test.js'],
    exclude: ['server/__tests__/production/**'],
    environment: 'node',
    setupFiles: ['server/__tests__/setup.js'],
    testTimeout: 10000,
  },
});
