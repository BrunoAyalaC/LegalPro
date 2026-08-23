// legalpro-app/server/adapters/CulqiAdapter.js
// Adaptador para Culqi (pasarela de pagos peruana) — API v2.0
// Con circuit breaker + retry + fallback
// Documentación oficial: https://docs.culqi.com/es/documentacion/api/

import { createResilienceManager } from '../utils/resilience.js';
import logger from '../logger.js';

const CULQI_API_BASE = 'https://api.culqi.com/v2';

// Circuit breaker específico para Culqi
const culqiResilience = createResilienceManager('Culqi', {
  maxRetries: 2,
  circuitTimeoutMs: 30000, // 30 segundos antes de reintentar
  fallback: () => ({
    object: 'error',
    type: 'service_unavailable',
    merchant_message: 'Culqi no está disponible en este momento. Intente más tarde.',
    user_message: 'El servicio de pagos no está disponible. Intente más tarde.',
    _fallback: true,
  }),
});

function getSecretKey() {
  const key = process.env.CULQI_SECRET_KEY;
  if (!key) {
    const err = new Error('CULQI_SECRET_KEY no configurada');
    err.status = 503;
    err.code = 'CULQI_NO_CONFIGURADO';
    throw err;
  }
  return key;
}

export function getPublicKey() {
  const key = process.env.CULQI_PUBLIC_KEY;
  if (!key) {
    const err = new Error('CULQI_PUBLIC_KEY no configurada');
    err.status = 503;
    err.code = 'CULQI_NO_CONFIGURADO';
    throw err;
  }
  return key;
}

async function culqiFetch(method, path, body = null) {
  const secretKey = getSecretKey();
  const url = `${CULQI_API_BASE}${path}`;
  const headers = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const json = await res.json();

  if (!res.ok) {
    const error = new Error(json.merchant_message || json.user_message || `Error Culqi: ${res.status}`);
    error.status = res.status;
    error.code = json.type || 'CULQI_ERROR';
    error.culqiData = json;
    throw error;
  }

  return json;
}

// Wrapper resiliente para culqiFetch
async function culqiFetchResilient(method, path, body = null) {
  return culqiResilience.call(() => culqiFetch(method, path, body), {
    fallback: async () => {
      logger.warn('[CulqiAdapter] Usando fallback — pago no procesado');
      return {
        object: 'error',
        type: 'service_unavailable',
        merchant_message: 'Culqi no está disponible. La transacción no se completó.',
        user_message: 'El servicio de pagos no está disponible en este momento. Intente más tarde.',
        _fallback: true,
      };
    },
  });
}

export async function createCharge(token, amount, description, options = {}) {
  const payload = {
    source_id: token,
    amount,
    currency_code: 'PEN',
    description: description.substring(0, 100),
    ...options,
  };
  return culqiFetchResilient('POST', '/charges', payload);
}

export async function getCharge(chargeId) {
  return culqiFetchResilient('GET', `/charges/${chargeId}`);
}

export async function createCustomer(email, firstName, lastName, options = {}) {
  const payload = { email, first_name: firstName, last_name: lastName, ...options };
  return culqiFetchResilient('POST', '/customers', payload);
}

export async function createCard(token, customerId) {
  return culqiFetchResilient('POST', '/cards', { token_id: token, customer_id: customerId });
}

export async function createPlan(name, amount, currencyCode = 'PEN', interval = 'meses', intervalCount = 1) {
  return culqiFetchResilient('POST', '/plans', {
    nombre: name, moneda: currencyCode, monto: amount,
    intervalo: interval, intervalo_repeticion: intervalCount,
  });
}

export async function verifyCharge(chargeId) {
  const charge = await getCharge(chargeId);
  if (charge._fallback) return { status: 'unknown', paid: false, _fallback: true };
  return {
    id: charge.id, status: charge.status, amount: charge.amount,
    currency: charge.currency_code, paid: charge.status === 'captured',
    cardBrand: charge.source?.card_brand, cardLast4: charge.source?.card_number?.slice(-4),
    receiptEmail: charge.source?.email, createdAt: charge.creation_date,
  };
}

export default { createCharge, getCharge, createCustomer, createCard, createPlan, verifyCharge, getPublicKey };

// Exponemos el estado del circuit breaker para health check
export function getCulqiStatus() {
  return culqiResilience.getStatus();
}
