/**
 * Vitest config para tests de PRODUCCIÓN REAL
 * Diferente del config de unit tests (que usa mocks)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ejecutar con: npm run test:prod:api
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Solo los archivos prod-*.test.js (sin mocks)
    include: ['server/__tests__/prod-*.test.js'],
    environment: 'node',
    // Sin setup files — no mockear nada
    setupFiles: [],
    // Timeout más alto porque golpea Railway (cold starts)
    testTimeout: 30000,
    hookTimeout: 30000,
    // No ejecutar en paralelo para no saturar Railway
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    // Mostrar datos detallados de las respuestas
    reporter: 'verbose',
    // Variables de entorno de producción (no se necesitan API keys locales)
    env: {
      NODE_ENV: 'test-production',
    },
  },
});
