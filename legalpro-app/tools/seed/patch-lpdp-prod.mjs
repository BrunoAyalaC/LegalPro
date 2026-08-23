/**
 * patch-lpdp-prod.mjs — Activa consentimiento transferencia internacional en usuarios demo
 * sin truncar datos. Idempotente.
 */
import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no definida. Ejecuta con DATABASE_URL="postgresql://..." (valor real en Railway).');
  process.exit(1);
}

async function main() {
  const c = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('rlwy.net') ? { rejectUnauthorized: false } : false,
  });
  await c.connect();

  const r = await c.query(`
    UPDATE usuarios
    SET acepta_transferencia_internacional = TRUE,
        consentimiento_transferencia_internacional = TRUE,
        transferencia_internacional_aceptada_en = COALESCE(transferencia_internacional_aceptada_en, NOW())
    WHERE eliminado_en IS NULL
      AND email LIKE '%@legalpro.pe'
      AND (NOT COALESCE(acepta_transferencia_internacional, FALSE)
           OR NOT COALESCE(consentimiento_transferencia_internacional, FALSE))
    RETURNING email`);

  console.log(`✅ Usuarios actualizados con consentimiento IA: ${r.rowCount}`);
  r.rows.forEach((u) => console.log(`   - ${u.email}`));

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
