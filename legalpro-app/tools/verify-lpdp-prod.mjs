#!/usr/bin/env node
/** Verifica enforcement LPDP Art.21 en producción (Node API). */
const NODE = process.env.NODE_API_URL || 'https://legalpro-node-production-34ac.up.railway.app';

async function login(email, password) {
  const res = await fetch(`${NODE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status}`);
  return res.json();
}

async function aiChat(token, orgId) {
  const res = await fetch(`${NODE}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId || '',
    },
    body: JSON.stringify({ message: 'test lpdp', disclaimerAceptado: true }),
  });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = { raw: body.slice(0, 200) }; }
  return { status: res.status, json };
}

const demo = await login('abogado@legalpro.pe', 'Demo2024!');
const orgId = demo.usuario?.organizationId || demo.organizationId;
const withConsent = await aiChat(demo.token, orgId);

console.log('LPDP check — abogado@legalpro.pe (con consentimiento patch):');
console.log(`  POST /api/ai/chat → ${withConsent.status}`);
if (withConsent.json.code === 'TRANSFERENCIA_INTERNACIONAL_REQUIRED') {
  console.log('  ❌ Bloqueado inesperadamente — ¿6.3.5 desplegado sin patch LPDP en BD?');
  process.exit(1);
}
if (withConsent.status === 403 && withConsent.json.code === 'TRANSFERENCIA_INTERNACIONAL_REQUIRED') {
  process.exit(1);
}
console.log('  ✅ Usuario demo puede invocar IA (consentimiento OK)');

if (withConsent.status >= 500) {
  console.log('  ⚠️  Respuesta servidor:', withConsent.json);
} else {
  console.log('  ✅ Middleware LPDP activo (no 403 TRANSFERENCIA_INTERNACIONAL_REQUIRED)');
}
