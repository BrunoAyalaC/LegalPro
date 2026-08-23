// legalpro-app/server/__tests__/resilience.test.js
// Tests unitarios del ResilienceManager (circuit breaker + retry + fallback)
// Sin mocks — probamos la lógica pura

import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { ResilienceManager } from '../utils/resilience.js';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

describe('ResilienceManager', () => {

  describe('Circuit Breaker', () => {
    it('debe ejecutar función exitosa y devolver resultado', async () => {
      const rm = new ResilienceManager('test');
      const result = await rm.call(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
      expect(rm.getStatus().failureCount).toBe(0);
      expect(rm.getStatus().circuitOpen).toBe(false);
    });

    it('debe abrir circuit breaker después de N fallos consecutivos', async () => {
      const rm = new ResilienceManager('test', { maxRetries: 0, circuitTimeoutMs: 5000 });
      const failingFn = () => Promise.reject(new Error('API error'));

      await expect(rm.call(failingFn)).rejects.toThrow('API error');

      const status = rm.getStatus();
      expect(status.circuitOpen).toBe(true);
      expect(status.failureCount).toBe(1);
      expect(status.circuitOpenUntil).toBeGreaterThan(Date.now());
    });

    it('debe rechazar llamadas mientras circuit breaker está abierto', async () => {
      const rm = new ResilienceManager('test', { maxRetries: 0, circuitTimeoutMs: 50000 });
      await rm.call(() => Promise.reject(new Error('fail'))).catch(() => {});

      // Circuit breaker abierto → debe usar fallback o lanzar error
      await expect(rm.call(() => Promise.resolve('ok')))
        .rejects.toThrow('test no disponible (circuit breaker abierto)');
    });

    it('debe usar fallback cuando circuit breaker está abierto', async () => {
      const rm = new ResilienceManager('test', {
        maxRetries: 0,
        circuitTimeoutMs: 50000,
        fallback: () => ({ fallback: true, data: 'cached' }),
      });
      await rm.call(() => Promise.reject(new Error('fail'))).catch(() => {});

      const result = await rm.call(() => Promise.resolve('should not reach'));
      expect(result).toEqual({ fallback: true, data: 'cached' });
    });

    it('debe resetear circuit breaker después del timeout', async () => {
      const rm = new ResilienceManager('test', { maxRetries: 0, circuitTimeoutMs: 100 });
      await rm.call(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(rm.getStatus().circuitOpen).toBe(true);

      await delay(150);

      // Después del timeout, debe intentar de nuevo (half-open)
      const result = await rm.call(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');
      expect(rm.getStatus().circuitOpen).toBe(false);
      expect(rm.getStatus().failureCount).toBe(0);
    });
  });

  describe('Retry', () => {
    it('debe reintentar función fallida hasta que tenga éxito', async () => {
      let attempts = 0;
      const rm = new ResilienceManager('test', { maxRetries: 3, circuitTimeoutMs: 5000 });
      const flakyFn = () => {
        attempts++;
        if (attempts < 3) return Promise.reject(new Error(`Intento ${attempts} falló`));
        return Promise.resolve('exitoso');
      };

      const result = await rm.call(flakyFn);
      expect(result).toBe('exitoso');
      expect(attempts).toBe(3);
      expect(rm.getStatus().circuitOpen).toBe(false);
    });

    it('debe fallar después de agotar todos los reintentos', async () => {
      const rm = new ResilienceManager('test', { maxRetries: 2, circuitTimeoutMs: 5000 });
      const alwaysFail = () => Promise.reject(new Error('Siempre falla'));

      await expect(rm.call(alwaysFail)).rejects.toThrow('Siempre falla');
      expect(rm.getStatus().failureCount).toBe(3); // 1 original + 2 retries
    });
  });

  describe('Fallback', () => {
    it('debe ejecutar fallback cuando todos los intentos fallan', async () => {
      const rm = new ResilienceManager('test', {
        maxRetries: 1,
        circuitTimeoutMs: 5000,
        fallback: () => ({ error: 'Servicio no disponible', fuente: 'fallback' }),
      });

      const result = await rm.call(() => Promise.reject(new Error('fail')));
      expect(result).toEqual({ error: 'Servicio no disponible', fuente: 'fallback' });
    });
  });

  describe('Reset manual', () => {
    it('debe resetear el circuit breaker manualmente', async () => {
      const rm = new ResilienceManager('test', { maxRetries: 0, circuitTimeoutMs: 50000 });
      await rm.call(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(rm.getStatus().circuitOpen).toBe(true);

      rm.reset();
      expect(rm.getStatus().circuitOpen).toBe(false);
      expect(rm.getStatus().failureCount).toBe(0);

      // Después del reset, debe ejecutar normalmente
      const result = await rm.call(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });
  });
});
