/**
 * cleanup-e2e-expedientes.mjs — Elimina expedientes creados por tests E2E/API en producción.
 * No toca EXP-2026-* ni datos demo sembrados.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node tools/seed/cleanup-e2e-expedientes.mjs
 */
import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no definida. Ejecuta con DATABASE_URL="postgresql://..." (valor real en Railway).');
  process.exit(1);
}

const PATTERNS = ['E2E-%', 'API-TEST-%', 'DEL-TEST-%'];

async function main() {
  const c = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('rlwy.net') ? { rejectUnauthorized: false } : false,
  });
  await c.connect();

  const conditions = PATTERNS.map((_, i) => `numero LIKE $${i + 1}`).join(' OR ');
  const countRes = await c.query(
    `SELECT COUNT(*)::int AS n FROM expedientes WHERE ${conditions}`,
    PATTERNS,
  );
  const toDelete = countRes.rows[0].n;
  console.log(`Expedientes E2E a eliminar: ${toDelete}`);

  if (toDelete === 0) {
    console.log('✅ Nada que limpiar.');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    await c.query(
      `DELETE FROM documentos WHERE expediente_id IN (
         SELECT id FROM expedientes WHERE ${conditions}
       )`,
      PATTERNS,
    );
    const del = await c.query(
      `DELETE FROM expedientes WHERE ${conditions} RETURNING numero`,
      PATTERNS,
    );
    await c.query('COMMIT');
    console.log(`✅ Eliminados ${del.rowCount} expedientes:`);
    del.rows.slice(0, 20).forEach((r) => console.log(`   - ${r.numero}`));
    if (del.rowCount > 20) console.log(`   ... y ${del.rowCount - 20} más`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
