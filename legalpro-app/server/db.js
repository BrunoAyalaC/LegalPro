/**
 * db.js — Pool de conexiones PostgreSQL para Railway
 * Reemplaza @supabase/supabase-js en el servidor Node.
 * Railway provee DATABASE_URL automáticamente al hacer deploy.
 */
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[db] ADVERTENCIA: DATABASE_URL no definida. ' +
    'Configura la variable en Railway: railway variables set DATABASE_URL=...'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/legalpro',
  ssl: process.env.DATABASE_URL && process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }  // Railway usa cert auto-firmado
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Error inesperado en cliente pg inactivo:', err.message);
});

export default pool;
