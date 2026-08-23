/**
 * patch-creditos-schema.mjs — Migración idempotente transacciones_creditos en prod.
 * Añade expediente_id, tipo, motivo si faltan (schema legacy init.sql).
 */
import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no definida. Ejecuta con DATABASE_URL="postgresql://..." (valor real en Railway).');
  process.exit(1);
}

async function columnExists(c, table, col) {
  const { rows } = await c.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, col],
  );
  return rows.length > 0;
}

async function main() {
  const c = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('rlwy.net') ? { rejectUnauthorized: false } : false,
  });
  await c.connect();

  const cols = ['expediente_id', 'tipo', 'motivo'];
  for (const col of cols) {
    const exists = await columnExists(c, 'transacciones_creditos', col);
    console.log(`transacciones_creditos.${col}: ${exists ? 'OK' : 'FALTA'}`);
  }

  await c.query(`
    ALTER TABLE organizaciones
      ADD COLUMN IF NOT EXISTS creditos_disponibles INTEGER NOT NULL DEFAULT 500;

    ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES expedientes(id) ON DELETE SET NULL;
    ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS tipo TEXT;
    ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS motivo TEXT;

    UPDATE transacciones_creditos SET motivo = COALESCE(NULLIF(motivo, ''), descripcion, 'Operación')
      WHERE motivo IS NULL OR motivo = '';

    UPDATE transacciones_creditos SET tipo = COALESCE(NULLIF(tipo, ''), tipo_operacion, 'CREDITO')
      WHERE tipo IS NULL OR tipo = '';

    UPDATE organizaciones SET creditos_disponibles = GREATEST(creditos_disponibles, 500)
      WHERE creditos_disponibles IS NULL OR creditos_disponibles < 50;

    ALTER TABLE transacciones_creditos ALTER COLUMN precio_pagado SET DEFAULT 0;
    ALTER TABLE transacciones_creditos ALTER COLUMN metodo_pago SET DEFAULT 'culqi';

    ALTER TABLE transacciones_creditos DROP CONSTRAINT IF EXISTS transacciones_creditos_cantidad_creditos_check;
    ALTER TABLE transacciones_creditos DROP CONSTRAINT IF EXISTS transacciones_creditos_metodo_pago_check;
    ALTER TABLE transacciones_creditos ADD CONSTRAINT transacciones_creditos_cantidad_check
      CHECK (cantidad <> 0);
    ALTER TABLE transacciones_creditos ADD CONSTRAINT transacciones_creditos_metodo_pago_check
      CHECK (metodo_pago = ANY (ARRAY['yape','transferencia','culqi','consumo_ia']));
  `);

  const { rows: demo } = await c.query(
    `UPDATE usuarios SET nombre_completo = 'Dr. Juan García Pérez'
     WHERE email = 'abogado@legalpro.pe' AND nombre_completo LIKE '%Garc%'
     RETURNING email, nombre_completo`,
  );
  if (demo.length) console.log('UTF-8 demo:', demo[0]);

  const { rows: org } = await c.query(
    `SELECT id, creditos_disponibles FROM organizaciones WHERE slug = 'estudio-demo' LIMIT 1`,
  );
  console.log('Org demo créditos:', org[0]);

  for (const col of cols) {
    const exists = await columnExists(c, 'transacciones_creditos', col);
    console.log(`post-patch ${col}: ${exists ? 'OK' : 'FALTA'}`);
  }

  await c.end();
  console.log('✅ Patch creditos schema completado');
}

main().catch((e) => { console.error(e); process.exit(1); });
