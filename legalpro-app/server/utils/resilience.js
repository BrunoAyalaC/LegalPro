// legalpro-app/server/utils/resilience.js
/// Módulo de resiliencia: Circuit Breaker + Retry + Fallback
///
/// Uso:
///   const resilience = new ResilienceManager('MiniMax', {
///     fallback: () => ({ resultado: 'Servicio no disponible' }),
///     maxRetries: 2,
///     circuitTimeoutMs: 60000,
///   });
///   const result = await resilience.call(() => iaApi.query(prompt));

import logger from '../logger.js';

export class ResilienceManager {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.fallback = options.fallback || null;
    this.maxRetries = options.maxRetries ?? 2;
    this.circuitTimeoutMs = options.circuitTimeoutMs ?? 60000;

    // Estado del circuit breaker
    this.circuitOpen = false;
    this.circuitOpenUntil = 0;
    this.failureCount = 0;
    this.lastFailure = null;
  }

  /**
   * Ejecuta una función con circuit breaker + retry + fallback.
   * @param {Function} fn - Función asíncrona a ejecutar
   * @param {object} options - Opciones por llamada (opcional)
   * @returns {Promise<any>}
   */
  async call(fn, options = {}) {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const fallback = options.fallback ?? this.fallback;

    // 1. Circuit breaker: verificar si está abierto
    if (this.circuitOpen) {
      if (Date.now() < this.circuitOpenUntil) {
        logger.warn(`[resilience] ${this.serviceName} circuit breaker OPEN`, {
          service: this.serviceName,
          failureCount: this.failureCount,
          remainingMs: this.circuitOpenUntil - Date.now(),
        });
        if (fallback) {
          logger.info(`[resilience] ${this.serviceName} usando fallback (circuit open)`);
          return fallback();
        }
        throw new Error(`${this.serviceName} no disponible (circuit breaker abierto)`);
      }
      // Medio abierto: probar de nuevo
      logger.info(`[resilience] ${this.serviceName} circuit breaker HALF-OPEN, probando...`);
      this.circuitOpen = false;
      this.failureCount = 0;
    }

    // 2. Ejecutar con retry
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        // Éxito: resetear contadores
        if (this.failureCount > 0) {
          logger.info(`[resilience] ${this.serviceName} recuperado después de ${this.failureCount} fallos`);
        }
        this.failureCount = 0;
        this.circuitOpen = false;
        return result;
      } catch (err) {
        lastError = err;
        this.lastFailure = { time: new Date().toISOString(), message: err.message };
        this.failureCount++;

        if (attempt < maxRetries) {
          // Retry con backoff exponencial: 1s, 2s, 4s...
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          logger.warn(`[resilience] ${this.serviceName} intento ${attempt + 1}/${maxRetries + 1} falló: ${err.message}`, {
            service: this.serviceName,
            attempt: attempt + 1,
            delay,
            error: err.message,
          });
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // 3. Todos los intentos fallaron: abrir circuit breaker
    this.circuitOpen = true;
    this.circuitOpenUntil = Date.now() + this.circuitTimeoutMs;
    logger.error(`[resilience] ${this.serviceName} circuit breaker OPEN después de ${this.failureCount} fallos`, {
      service: this.serviceName,
      failureCount: this.failureCount,
      circuitTimeoutMs: this.circuitTimeoutMs,
      lastError: lastError?.message,
    });

    // 4. Fallback si existe
    if (fallback) {
      logger.info(`[resilience] ${this.serviceName} usando fallback (todos los intentos fallaron)`);
      return fallback();
    }

    throw lastError || new Error(`${this.serviceName} no disponible`);
  }

  /**
   * Estado actual del circuit breaker (para health check / debug).
   */
  getStatus() {
    return {
      service: this.serviceName,
      circuitOpen: this.circuitOpen,
      circuitOpenUntil: this.circuitOpenUntil,
      failureCount: this.failureCount,
      lastFailure: this.lastFailure,
      healthy: !this.circuitOpen || Date.now() >= this.circuitOpenUntil,
    };
  }

  /**
   * Resetea manualmente el circuit breaker.
   */
  reset() {
    this.circuitOpen = false;
    this.circuitOpenUntil = 0;
    this.failureCount = 0;
    this.lastFailure = null;
    logger.info(`[resilience] ${this.serviceName} circuit breaker reseteado manualmente`);
  }
}

/**
 * Crea un ResilienceManager con valores por defecto sensatos.
 */
export function createResilienceManager(serviceName, options = {}) {
  return new ResilienceManager(serviceName, {
    maxRetries: 2,
    circuitTimeoutMs: 60000,
    ...options,
  });
}

export default { ResilienceManager, createResilienceManager };
