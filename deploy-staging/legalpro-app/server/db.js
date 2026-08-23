/**
 * db.js — Pool de conexiones PostgreSQL para Railway
 * Con autoreconexión en caso de caída de la BD
 */
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[db] ADVERTENCIA: DATABASE_URL no definida. ' +
    'Configura la variable en Railway: railway variables set DATABASE_URL=...'
  );
}

function resolveSslConfig() {
  const mode = (process.env.PGSSLMODE || '').toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'require' || mode === 'no-verify' || mode === 'prefer') {
    return { rejectUnauthorized: false };
  }
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    return { rejectUnauthorized: false };
  }
  return false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:***@localhost:5432/legalpro',
  ssl: resolveSslConfig(),
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  query_timeout: 10_000,
});

// Manejar errores del pool con autoreconexión
pool.on('error', (err) => {
  console.error('[db] Error en pool PostgreSQL:', err.message);
  // El pool de pg intenta reconectar automáticamente en la siguiente consulta
  // Solo logueamos — no matamos el proceso
});

// Verificar conectividad al arrancar
pool.query('SELECT 1').then(() => {
  console.log('[db] Conexión PostgreSQL establecida');
}).catch((err) => {
  console.error('[db] Error inicial de conexión PostgreSQL:', err.message);
  console.warn('[db] El servidor arrancará pero las consultas fallarán hasta que la BD esté disponible');
});

export default pool;
