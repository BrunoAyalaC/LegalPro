/**
 * db.js — Pool de conexiones PostgreSQL para Railway
 * Con autoreconexión en caso de caída de la BD
 *
 * FIX R-01 (CRITICAL multi-tenant RLS):
 *   Exporta `tenantContext` (AsyncLocalStorage) y `tenantQuery(...)`.
 *   Cada query ejecutada dentro de un tenantContext.run({org_id, user_id, user_rol})
 *   hereda automáticamente los SET LOCAL de las variables de sesión
 *   `app.current_org_id`, `app.current_user_id`, `app.current_user_rol`,
 *   que activan las policies RLS de PostgreSQL (fn_rls_current_*).
 *
 *   Uso en middleware (ver middleware/tenantMiddleware.js):
 *     tenantContext.run({ org_id, user_id, user_rol }, () => next())
 *
 *   Uso en rutas:
 *     import { tenantQuery } from '../db.js';
 *     await tenantQuery('SELECT * FROM expedientes WHERE id=$1', [id]);
 *
 *   Si no hay contexto activo (ej. /health, seeds, scripts de admin), se
 *   usa `pool.query` directamente sin SET LOCAL — pero ese código no debe
 *   tocar tablas con policies RLS activadas.
 */
import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const { Pool } = pg;

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[db] ADVERTENCIA: DATABASE_URL no definida. ' +
    'Configura la variable en Railway: railway variables set DATABASE_URL=...'
  );
}

function resolveSslConfig() {
  const mode = (process.env.PGSSLMODE || '').toLowerCase();

  // Desactivado explícitamente (solo entornos locales de confianza).
  if (mode === 'disable') return false;

  // verify-full / verify-ca: TLS verificado (RECOMENDADO en producción).
  if (mode === 'verify-full' || mode === 'verify-ca') {
    const cfg = { rejectUnauthorized: true };
    if (process.env.PGSSLROOTCERT) cfg.ca = process.env.PGSSLROOTCERT;
    return cfg;
  }

  // require / prefer / no-verify: cifrado sin verificar certificado.
  if (mode === 'require' || mode === 'no-verify' || mode === 'prefer') {
    return { rejectUnauthorized: false };
  }

  // ── Default de producción: SEGURO por defecto (TLS verificado) ──
  // FIX P0-3: antes se devolvía { rejectUnauthorized: false } siempre, lo que
  // exponía la conexión a MITM. Ahora verificamos el certificado por defecto.
  // Variable de escape PGSSL_NO_VERIFY=true para no romper despliegues con
  // certificados autofirmados (DEPRECADO: migrar a PGSSLMODE=verify-full).
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    if (process.env.PGSSL_NO_VERIFY === 'true') {
      console.warn('[db] DEPRECADO: PGSSL_NO_VERIFY=true desactiva la verificación TLS. Migre a PGSSLMODE=verify-full.');
      return { rejectUnauthorized: false };
    }
    const cfg = { rejectUnauthorized: true };
    if (process.env.PGSSLROOTCERT) cfg.ca = process.env.PGSSLROOTCERT;
    return cfg;
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

// ─────────────────────────────────────────────────────────────────────────────
// R-01 FIX: AsyncLocalStorage + tenantQuery()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Almacén asincrónico de contexto tenant (org_id, user_id, user_rol).
 * El middleware tenantMiddleware.js envuelve cada request en
 * tenantContext.run({...}, () => next()) de modo que cualquier
 * tenantQuery() que se ejecute dentro del request hereda los session vars
 * que activan las policies RLS de PostgreSQL.
 */
export const tenantContext = new AsyncLocalStorage();

/**
 * Sanitiza un valor para usarlo como session var de Postgres (texto).
 * Devuelve string seguro o null si el valor es vacío/null/undefined.
 */
function toSessionValue(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * Wrapper de query que automáticamente aplica SET LOCAL para RLS multi-tenant.
 *
 * Si hay un tenantContext activo:
 *   1. Toma un cliente dedicado del pool.
 *   2. Inicia transacción (BEGIN).
 *   3. Ejecuta set_config('app.current_org_id', ..., true) — true = LOCAL.
 *   4. Ejecuta set_config('app.current_user_id', ..., true).
 *   5. Ejecuta set_config('app.current_user_rol', ..., true).
 *   6. Ejecuta la query del caller.
 *   7. COMMIT (o ROLLBACK en error).
 *   8. Libera el cliente.
 *
 * Sin contexto activo (queries de sistema: /health, seeds, scripts admin):
 *   usa pool.query() directamente. Dichas queries NO deben tocar tablas con
 *   policies RLS activas.
 *
 * @param {string} text  — SQL con placeholders $1, $2, ...
 * @param {Array}  params — parámetros
 * @returns {Promise<pg.QueryResult>}
 */
export async function tenantQuery(text, params = []) {
  const ctx = tenantContext.getStore();

  if (ctx) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orgId = toSessionValue(ctx.org_id);
      const userId = toSessionValue(ctx.user_id);
      const userRol = toSessionValue(ctx.user_rol);

      // Performance FIX: batch 3 SET LOCAL en 1 round-trip (1 query vs 3)
      // SELECT set_config(...), set_config(...), set_config(...) es atómico dentro de la tx
      await client.query(
        "SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true), set_config('app.current_user_rol', $3, true)",
        [orgId || '', userId || '', userRol || '']
      );

      const result = await client.query(text, params);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackErr) {
        // Ignorar errores secundarios de rollback
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // Sin contexto de tenant → fallback a query normal (para queries de sistema como /health)
  return pool.query(text, params);
}

export default pool;