import pg from 'pg';
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no definida. Ejecuta con DATABASE_URL="postgresql://..." (valor real en Railway).');
  process.exit(1);
}
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'transacciones_creditos'
  ORDER BY ordinal_position`);
console.table(r.rows);
await c.end();
