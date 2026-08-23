import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
          'server/__tests__/**/*.test.js',
          'src/api/__tests__/**/*.test.js',
          'src/**/__tests__/**/*.test.{js,jsx}',
        ],
        exclude: ['server/__tests__/production/**'],
    environment: 'node',
    setupFiles: ['server/__tests__/setup.js'],
    testTimeout: 10000,
  },
});
