/**
 * test-same-db.mjs — Test definitivo: verifica si Node y URL pública son la misma DB
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const DB_URL = 'postgresql://postgres:cyyvfHNDpNycUzURTglWbJzfiZaEDAjj@metro.proxy.rlwy.net:42060/railway';
const NODE_API = 'https://legalpro-node-production.up.railway.app';
const TEST_EMAIL = 'samedb-verify@test.pe';
const TEST_PASS = 'Test2026!';

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

// Crear usuario vía URL pública
const hash = await bcrypt.hash(TEST_PASS, 12);
try { await pool.query('DELETE FROM usuarios WHERE email=$1', [TEST_EMAIL]); } catch (e) {}
const ins = await pool.query(
  `INSERT INTO usuarios(nombre_completo,email,password_hash,rol,especialidad,esta_activo) 
   VALUES($1,$2,$3,$4,$5,TRUE) RETURNING id`,
  ['Test SameDB', TEST_EMAIL, hash, 'ABOGADO', 'GENERAL']
);
console.log('✓ Usuario insertado via URL pública → id:', ins.rows[0].id);

// Contar usuarios para confirmar
const cnt = await pool.query('SELECT COUNT(*) FROM usuarios');
console.log('  Total usuarios en DB pública:', cnt.rows[0].count);
await pool.end();

// Esperar un momento
await new Promise(r => setTimeout(r, 2000));

// Test 1: Node login con usuario creado via URL pública
console.log('\nTest: Node login con usuario creado via URL pública...');
const res = await fetch(`${NODE_API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
  signal: AbortSignal.timeout(15000),
});
const body = await res.json();
console.log('  Status:', res.status);
if (res.status === 200 && body.token) {
  console.log('  ✅ MISMA DB: Node puede acceder al usuario creado via URL pública');
  console.log('  Token:', body.token.substring(0, 30) + '...');
} else {
  console.log('  ❌ BASES DE DATOS DISTINTAS o error:', JSON.stringify(body));
}

// Test 2: Login con usuarios del seed
console.log('\nTest: Node login con usuario seed (Abogado2024!)...');
const res2 = await fetch(`${NODE_API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'abogado@legalpro.pe', password: 'Abogado2024!' }),
  signal: AbortSignal.timeout(15000),
});
const body2 = await res2.json();
console.log('  Abogado status:', res2.status, JSON.stringify(body2).substring(0, 100));

// Test 3: Node register (para ver si aún falla)
console.log('\nTest: Node register...');
const res3 = await fetch(`${NODE_API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nombreCompleto: 'RegTest2026', email: 'regtest2026@test.pe', password: 'RegTest2026!', rol: 'ABOGADO' }),
  signal: AbortSignal.timeout(15000),
});
const body3 = await res3.json();
console.log('  Register status:', res3.status, JSON.stringify(body3).substring(0, 150));
