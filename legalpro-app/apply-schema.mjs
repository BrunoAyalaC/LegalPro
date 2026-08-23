/**
 * apply-schema.mjs — Aplica docker/init.sql al Railway PostgreSQL
 * Usar: node legalpro-app/apply-schema.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// URL pública del Railway PostgreSQL (acceso externo)
const DB_URL = process.env.DATABASE_PUBLIC_URL
  || 'postgresql://postgres:cyyvfHNDpNycUzURTglWbJzfiZaEDAjj@metro.proxy.rlwy.net:42060/railway';

const sqlPath = resolve(__dir, '../docker/init.sql');
const sql = readFileSync(sqlPath, 'utf8');

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  LegalPro — Aplicando init.sql a Railway PostgreSQL  ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`Leyendo: ${sqlPath}`);
console.log(`Tamaño SQL: ${sql.length} chars`);

const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

try {
  await client.connect();
  console.log('\n✓ Conectado a Railway PostgreSQL');

  // Verificar tablas existentes antes
  const before = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log(`  Tablas existentes: ${before.rows.length === 0 ? 'NINGUNA (DB vacía)' : before.rows.map(r=>r.table_name).join(', ')}`);

  console.log('\n⏳ Ejecutando init.sql...');

  // Ejecutar el SQL completo — pg soporta múltiples statements en simple query protocol
  await client.query(sql);

  console.log('  ✓ init.sql aplicado correctamente\n');

  // Verificar tablas creadas
  const after = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log(`=== TABLAS CREADAS (${after.rows.length}) ===`);
  after.rows.forEach(r => console.log(` ✓ ${r.table_name}`));

  // Verificar columnas de usuarios
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios'
    ORDER BY ordinal_position
  `);
  console.log(`\n=== COLUMNAS de usuarios (${cols.rows.length}) ===`);
  cols.rows.forEach(c => console.log(` ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`));

  // Test INSERT + DELETE en usuarios
  console.log('\n=== TEST INSERT usuario ===');
  const ins = await client.query(
    `INSERT INTO usuarios (nombre_completo, email, password_hash, rol, especialidad, esta_activo) 
     VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id, email`,
    ['Test Schema', 'schema-test@legalpro.pe', '$2b$12$test', 'ABOGADO', 'GENERAL']
  );
  console.log(' ✓ INSERT OK → id:', ins.rows[0].id);
  await client.query('DELETE FROM usuarios WHERE email=$1', ['schema-test@legalpro.pe']);
  console.log(' ✓ CLEANUP OK');

  console.log('\n✅ Schema aplicado y verificado correctamente');

} catch (err) {
  console.error('\n❌ ERROR:', err.message);
  if (err.detail) console.error('   Detail:', err.detail);
  process.exit(1);
} finally {
  await client.end();
}
