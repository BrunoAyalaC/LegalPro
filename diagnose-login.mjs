/**
 * Diagnóstico completo de login en producción — LegalPro
 * Prueba TODOS los flujos de auth en ambos backends
 */

const NODE_API = 'https://legalpro-node-production-34ac.up.railway.app';
const DOTNET_API = 'https://legalpro-dotnet-production-5a39.up.railway.app';

const log = (label, data) => console.log(`\n[${label}]`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));

async function fetchFull(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, headers: Object.fromEntries(res.headers), text, json };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   DIAGNÓSTICO LOGIN PRODUCCIÓN — LegalPro        ║');
console.log('╚═══════════════════════════════════════════════════╝');

// ── 1. Health checks ──
log('HEALTH', 'Verificando backends...');
const h1 = await fetchFull(`${NODE_API}/health`);
const h2 = await fetchFull(`${DOTNET_API}/health`);
console.log(`  Node:  ${h1.status} ${h1.json?.status || h1.text?.substring(0, 50) || h1.error}`);
console.log(`  .NET:  ${h2.status} ${h2.text?.substring(0, 50) || h2.error}`);

// ── 2. Test Node login con usuarios que podrían existir ──
log('NODE LOGIN', 'Probando login con distintos usuarios...');

const testLogins = [
  { email: 'admin@legalpro.pe', password: 'admin' },
  { email: 'admin@legalpro.pe', password: 'Admin123!' },
  { email: 'admin@legalpro.pe', password: 'LegalPro2026!' },
  { email: 'owner@legalpro.pe', password: 'Admin123!' },
  { email: 'test@legalpro.pe', password: 'Test1234!' },
  { email: 'bruno@legalpro.pe', password: 'Admin123!' },
];

for (const cred of testLogins) {
  const r = await fetchFull(`${NODE_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cred),
  });
  console.log(`  ${cred.email} / ${cred.password} → ${r.status} ${r.json?.message || r.json?.error || ''}`);
}

// ── 3. Test .NET login con mismos usuarios ──
log('.NET LOGIN', 'Probando login en .NET...');

for (const cred of testLogins) {
  const r = await fetchFull(`${DOTNET_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cred),
  });
  console.log(`  ${cred.email} / ${cred.password} → ${r.status} ${r.json?.message || r.json?.error || r.text?.substring(0, 100) || ''}`);
}

// ── 4. Intentar registrar usuario nuevo en Node ──
log('NODE REGISTER', 'Registrando usuario de prueba...');
const regNode = await fetchFull(`${NODE_API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombreCompleto: 'Admin Demo',
    email: 'demo-admin@legalpro.pe',
    password: 'LegalPro2026!',
    rol: 'ABOGADO'
  }),
});
console.log(`  Register: ${regNode.status}`, regNode.json);

// ── 5. Si se registró o ya existe, probar login ──
log('NODE LOGIN POST-REGISTER', 'Login con usuario demo...');
const loginNode = await fetchFull(`${NODE_API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-admin@legalpro.pe', password: 'LegalPro2026!' }),
});
console.log(`  Login: ${loginNode.status}`, loginNode.json);

if (loginNode.json?.token) {
  // ── 6. Probar /me con token ──
  log('NODE /me', 'Verificando perfil con JWT...');
  const me = await fetchFull(`${NODE_API}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${loginNode.json.token}` },
  });
  console.log(`  /me: ${me.status}`, me.json);
}

// ── 7. Registrar en .NET ──
log('.NET REGISTER', 'Registrando en .NET...');
const regNet = await fetchFull(`${DOTNET_API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombreCompleto: 'Admin Demo NET',
    email: 'demo-admin-net@legalpro.pe',
    password: 'LegalPro2026!',
    rol: 'ABOGADO'
  }),
});
console.log(`  Register .NET: ${regNet.status}`, regNet.json);

// ── 8. Login .NET ──
log('.NET LOGIN POST-REGISTER', 'Login .NET...');
const loginNet = await fetchFull(`${DOTNET_API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-admin-net@legalpro.pe', password: 'LegalPro2026!' }),
});
console.log(`  Login .NET: ${loginNet.status}`, loginNet.json);

if (loginNet.json?.token) {
  log('.NET /expedientes', 'Probando ruta protegida...');
  const exp = await fetchFull(`${DOTNET_API}/api/expedientes`, {
    headers: { 'Authorization': `Bearer ${loginNet.json.token}` },
  });
  console.log(`  Expedientes: ${exp.status}`, exp.json || exp.text?.substring(0, 200));
}

// ── 9. Verificar qué usuarios existen en Supabase ──
log('SUPABASE DIRECT', 'Consultando usuarios en DB...');
const SUPABASE_URL = 'https://yddkasmxxgrmmwlotfyx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkZGthc214eGdybW13bG90Znl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MTExNDEsImV4cCI6MjA4OTM4NzE0MX0.o7PZVGc-2FGHa3g_ggM_7P908ExGCh8trMYkjDi8O3A';

const usersQ = await fetchFull(
  `${SUPABASE_URL}/rest/v1/usuarios?select=id,email,nombre_completo,rol,esta_activo,created_at&order=id.asc`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
);
console.log(`  Usuarios en DB (${usersQ.status}):`);
if (usersQ.json && Array.isArray(usersQ.json)) {
  usersQ.json.forEach(u => console.log(`    [${u.id}] ${u.email} | ${u.rol} | activo=${u.esta_activo} | ${u.created_at}`));
} else {
  console.log(`    Error: ${usersQ.text?.substring(0, 200)}`);
}

console.log('\n══════════════════════════════════════════════════════');
console.log('DIAGNÓSTICO COMPLETO');
