/**
 * seed-admin.mjs — Crea usuarios de prueba en Railway PostgreSQL
 * para verificar que el DB externo e interno son el mismo
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const DB_URL = 'postgresql://postgres:cyyvfHNDpNycUzURTglWbJzfiZaEDAjj@metro.proxy.rlwy.net:42060/railway';

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

const hash = await bcrypt.hash('LegalPro2026!', 12);

// Crear usuario admin para pruebas
try {
  // Borrar si existe
  await pool.query('DELETE FROM usuarios WHERE email = $1', ['admin@legalpro.pe']);
  
  const r = await pool.query(
    `INSERT INTO usuarios (nombre_completo, email, password_hash, rol, especialidad, esta_activo)
     VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id, email`,
    ['Admin LegalPro', 'admin@legalpro.pe', hash, 'ADMIN', 'GENERAL']
  );
  console.log('✓ admin@legalpro.pe creado → id:', r.rows[0].id);
} catch (e) {
  console.error('✗ admin:', e.message);
}

// Crear usuario abogado para pruebas
const hash2 = await bcrypt.hash('Abogado2026!', 12);
try {
  await pool.query('DELETE FROM usuarios WHERE email = $1', ['abogado@legalpro.pe']);
  const r = await pool.query(
    `INSERT INTO usuarios (nombre_completo, email, password_hash, rol, especialidad, esta_activo)
     VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id, email`,
    ['Abogado Demo', 'abogado@legalpro.pe', hash2, 'ABOGADO', 'CIVIL']
  );
  console.log('✓ abogado@legalpro.pe creado → id:', r.rows[0].id);
} catch (e) {
  console.error('✗ abogado:', e.message);
}

// Verificar cuántos usuarios hay
const count = await pool.query('SELECT COUNT(*) FROM usuarios');
console.log('\nTotal usuarios en DB:', count.rows[0].count);

// Ahora probar si el Node API puede ver estos usuarios
console.log('\nProbando Node API login con admin@legalpro.pe...');
const NODE_API = 'https://legalpro-node-production.up.railway.app';

// Esperar un momento para que el redeploy termine
await new Promise(r => setTimeout(r, 5000));

try {
  const res = await fetch(`${NODE_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@legalpro.pe', password: 'LegalPro2026!' }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  if (res.status === 200 && body.token) {
    console.log('✅ Node login OK → token:', body.token.substring(0, 30) + '...');
    console.log('   CONFIRMADO: Node y URL público comparten la MISMA DB');
  } else {
    console.log(`⚠️  Node login devolvió ${res.status}:`, JSON.stringify(body));
    console.log('   POSIBLE: Node y URL público usan DBs DISTINTAS');
  }
} catch (e) {
  console.error('Error en fetch:', e.message);
}

await pool.end();
