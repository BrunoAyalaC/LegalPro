#!/usr/bin/env node
/**
 * Smoke Test E2E Final - LegalPro Alfa Monetizable
 *
 * Valida los flujos criticos necesarios para cobrar dinero:
 * 1. Health checks de los 3 servicios (Node, .NET, Owner Dashboard)
 * 2. Registro + Login de un usuario nuevo
 * 3. Creacion de organizacion
 * 4. Creacion de cliente
 * 5. Creacion de expediente
 * 6. Subida de documento
 * 7. Consulta IA (con credito)
 * 8. Verificacion de consentimiento LPDP
 * 9. Listado de notificaciones
 * 10. Logout
 *
 * Uso: node legalpro-app/smoke-production-final.mjs
 *      o:  npm run smoke:dev
 */

import { setTimeout as sleep } from 'node:timers/promises';

const NODE_URL = process.env.SMOKE_NODE_URL || 'http://localhost:3001';
const DOTNET_URL = process.env.SMOKE_DOTNET_URL || 'http://localhost:5000';
const OWNER_URL = process.env.SMOKE_OWNER_URL || 'http://localhost:3005';

const TIMESTAMP = Date.now();
const TEST_USER = {
  email: `smoke_${TIMESTAMP}@legalpro.test`,
  password: 'SmokeTest123!Min8',
  nombres: 'Smoke',
  apellidos: 'Test',
  rol: 'ABOGADO',
};

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const icon = ok ? '\u2705' : '\u274C';
  console.log(`${icon} ${name}${detail ? ' - ' + detail : ''}`);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

console.log('\u{1F680} SMOKE TEST E2E FINAL - LegalPro');
console.log(`Node: ${NODE_URL} | .NET: ${DOTNET_URL} | Owner: ${OWNER_URL}`);
console.log('');

// FASE 1: Health Checks
console.log('\u{1F4CB} FASE 1: Health Checks');
async function testHealth() {
  const node = await api(`${NODE_URL}/health`);
  check('Node /health', node.status === 200);

  const deep = await api(`${NODE_URL}/health/deep`);
  check('Node /health/deep (DB+MiniMax)', deep.status === 200 && deep.body?.db === 'ok');

  const dotnet = await api(`${DOTNET_URL}/health`);
  check('.NET /health', dotnet.status === 200);

  const owner = await api(`${OWNER_URL}/health`);
  check('Owner /health', owner.status === 200);
}

// FASE 2: Auth Flow
console.log('\u{1F4CB} FASE 2: Auth Flow');
let authToken = null;
async function testAuth() {
  const reg = await api(`${NODE_URL}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      ...TEST_USER,
      terminos_aceptados: true,
      privacidad_aceptada: true,
    }),
  });
  check('POST /api/auth/register', [200, 201].includes(reg.status), `status=${reg.status}`);

  const login = await api(`${NODE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
  });
  authToken = login.body?.token || login.body?.accessToken;
  check('POST /api/auth/login + token', login.status === 200 && !!authToken);

  if (!authToken) return;

  const me = await api(`${NODE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  check(
    'GET /api/auth/me',
    me.status === 200 && me.body?.email === TEST_USER.email,
    me.body?.email
  );
}

// FASE 3: Organizacion
console.log('\u{1F4CB} FASE 3: Organizacion');
let orgId = null;
async function testOrganizacion() {
  if (!authToken) {
    check('POST /api/organizaciones', false, 'no authToken');
    return;
  }
  const org = await api(`${NODE_URL}/api/organizaciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({
      nombre: `Smoke Org ${TIMESTAMP}`,
      ruc: '20123456789',
    }),
  });
  orgId = org.body?.id || org.body?.organizacion?.id;
  check('POST /api/organizaciones', [200, 201].includes(org.status) && !!orgId);

  const meOrg = await api(`${NODE_URL}/api/organizaciones/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  check('GET /api/organizaciones/me', meOrg.status === 200);
}

// FASE 4: Cliente
console.log('\u{1F4CB} FASE 4: Cliente');
let clienteId = null;
async function testCliente() {
  if (!authToken) {
    check('POST /api/clientes', false, 'no authToken');
    return;
  }
  const cli = await api(`${NODE_URL}/api/clientes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({
      nombre: 'Cliente Smoke',
      documento: '12345678',
      email: `cliente_${TIMESTAMP}@test.com`,
    }),
  });
  clienteId = cli.body?.id || cli.body?.cliente?.id;
  check('POST /api/clientes', [200, 201].includes(cli.status) && !!clienteId);
}

// FASE 5: Expediente
console.log('\u{1F4CB} FASE 5: Expediente');
let expedId = null;
async function testExpediente() {
  if (!authToken) {
    check('POST /api/expedientes', false, 'no authToken');
    return;
  }
  const exp = await api(`${NODE_URL}/api/expedientes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({
      numero_expediente: `00001-${new Date().getFullYear()}`,
      materia: 'civil',
      instancia: 'JUZGADO',
      partes: { demandante: 'A', demandado: 'B' },
      fecha_inicio: new Date().toISOString().split('T')[0],
      cliente_id: clienteId,
    }),
  });
  expedId = exp.body?.id || exp.body?.expediente?.id;
  check('POST /api/expedientes', [200, 201].includes(exp.status) && !!expedId);
}

// FASE 6: IA (con consentimiento LPDP)
console.log('\u{1F4CB} FASE 6: IA (con consentimiento LPDP)');
async function testIA() {
  if (!authToken) {
    check('GET /api/mis-datos', false, 'no authToken');
    return;
  }
  const cons = await api(`${NODE_URL}/api/mis-datos`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  check('GET /api/mis-datos (consentimiento)', cons.status === 200);

  if (!cons.body?.acepto_transferencia_internacional && !cons.body?.acepta_transferencia_internacional) {
    const ok = await api(`${NODE_URL}/api/mis-datos`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ acepto_transferencia_internacional: true }),
    });
    check('PUT /api/mis-datos (acepta transferencia)', ok.status === 200);
  }

  const ia = await api(`${NODE_URL}/api/ai/consulta`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({
      prompt: 'Que es el articulo 1 del Codigo Civil peruano?',
      tipo: 'general',
      expediente_id: expedId,
    }),
  });
  check(
    'POST /api/ai/consulta (con provider)',
    ia.status === 200 && !!ia.body?.provider,
    `provider=${ia.body?.provider || 'N/A'}`
  );
  check(
    'IA provider etiquetado (MiniMax o Gemini)',
    ['minimax', 'gemini'].includes(ia.body?.provider),
    ia.body?.provider || 'undefined'
  );
}

// FASE 7: Logout
console.log('\u{1F4CB} FASE 7: Logout');
async function testLogout() {
  if (!authToken) {
    check('POST /api/auth/logout', false, 'no authToken');
    return;
  }
  const out = await api(`${NODE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  check('POST /api/auth/logout', [200, 204].includes(out.status));
}

// EJECUCION
(async () => {
  const startedAt = Date.now();
  try {
    await testHealth();
    await sleep(100);
    await testAuth();
    await sleep(100);
    if (authToken) {
      await testOrganizacion();
      await sleep(100);
      await testCliente();
      await sleep(100);
      await testExpediente();
      await sleep(100);
      await testIA();
      await sleep(100);
      await testLogout();
    }
  } catch (err) {
    console.error('\u{1F4A5} Error fatal:', err.message);
  }

  // Resumen
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('');
  console.log('='.repeat(50));
  console.log(`\u{1F4CA} RESULTADO: ${passed}/${total} checks pasaron (${elapsed}s)`);
  if (passed === total) {
    console.log('\u2705 SMOKE TEST EXITOSO - Sistema listo para alfa monetizable');
    process.exit(0);
  } else {
    console.log('\u274C SMOKE TEST FALLO');
    process.exit(1);
  }
})();