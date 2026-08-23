#!/usr/bin/env node
/** Smoke .NET 6.3.5 post-deploy — endpoints que usa el frontend. */
const NODE = process.env.NODE_API_URL || 'https://legalpro-node-production-34ac.up.railway.app';
const DOTNET = process.env.DOTNET_API_URL || 'https://legalpro-dotnet-production-5a39.up.railway.app';

async function login() {
  const res = await fetch(`${NODE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'abogado@legalpro.pe', password: 'Demo2024!' }),
  });
  if (!res.ok) throw new Error(`Login: ${res.status}`);
  return res.json();
}

async function dotnetGet(path, token, orgId) {
  const res = await fetch(`${DOTNET}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId || '',
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 150); }
  return { status: res.status, body };
}

const { token, usuario, organizacion } = await login();
const orgId = organizacion?.id;
console.log('Smoke .NET 6.3.6 —', DOTNET);
console.log('Org:', orgId);

const health = await fetch(`${DOTNET}/health`);
console.log(`\nGET /health → ${health.status} (${await health.text()})`);

const endpoints = [
  '/api/expedientes?page=1&limit=5',
  '/api/notificaciones',
];

let ok = 0;
let fail = 0;
for (const ep of endpoints) {
  const r = await dotnetGet(ep, token, orgId);
  const pass = r.status >= 200 && r.status < 400;
  console.log(`${pass ? '✅' : '❌'} GET ${ep} → ${r.status}`);
  if (!pass) console.log('   ', JSON.stringify(r.body).slice(0, 200));
  pass ? ok++ : fail++;
}

console.log(`\n${ok}/${endpoints.length} endpoints OK`);
process.exit(fail ? 1 : 0);
