/**
 * check-db-tables.mjs — Diagnostica la DB de Railway PostgreSQL
 * Usar: railway run --service legalpro-node node check-db-tables.mjs
 */
import pg from 'pg';

const { Pool } = pg;

const PUBLIC_URL = 'postgresql://postgres:cyyvfHNDpNycUzURTglWbJzfiZaEDAjj@metro.proxy.rlwy.net:42060/railway';

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

console.log('Conectando a Railway PostgreSQL (público)...');

// 1. Listar tablas
const tables = await pool.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
);
console.log('\n=== TABLAS EN DB ===');
if (tables.rows.length === 0) {
  console.log('  *** NO HAY TABLAS — El schema no fue aplicado ***');
} else {
  tables.rows.forEach(r => console.log(' ✓', r.table_name));
}

// 2. Si existe usuarios, ver columnas
if (tables.rows.some(r => r.table_name === 'usuarios')) {
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios'
    ORDER BY ordinal_position
  `);
  console.log('\n=== COLUMNAS DE usuarios ===');
  cols.rows.forEach(c => console.log(
    ` ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable} default=${c.column_default ?? 'none'}`
  ));

  // 3. Contar usuarios
  const count = await pool.query('SELECT COUNT(*) as n FROM usuarios');
  console.log(`\n=== USUARIOS EN DB: ${count.rows[0].n} ===`);

  // 4. Test INSERT
  console.log('\n=== TEST INSERT ===');
  try {
    const r = await pool.query(
      `INSERT INTO usuarios (nombre_completo, email, password_hash, rol, especialidad, esta_activo)
       VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id`,
      ['Test Diag', 'diagtest@legalpro.pe', '$2b$12$dummyhash00000000000000000000000', 'ABOGADO', 'GENERAL']
    );
    console.log('  INSERT OK → id:', r.rows[0]?.id);
    // Limpiar
    await pool.query('DELETE FROM usuarios WHERE email=$1', ['diagtest@legalpro.pe']);
    console.log('  CLEANUP OK');
  } catch (e) {
    console.error('  INSERT FAILED:', e.message);
    console.error('  Detail:', e.detail);
  }
} else {
  console.log('\n*** TABLA usuarios NO EXISTE — Necesitas aplicar init.sql ***');
}

await pool.end();
