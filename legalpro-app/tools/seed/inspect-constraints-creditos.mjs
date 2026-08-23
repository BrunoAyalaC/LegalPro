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
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'transacciones_creditos'::regclass`);
console.table(r.rows);
await c.end();
