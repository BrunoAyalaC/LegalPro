/**
 * BaseRepository — Clase base para repositorios PostgreSQL.
 * Recibe el pool de conexiones pg y, opcionalmente, el nombre de la tabla
 * con la que trabaja el repositorio (lo asigna a this.table).
 *
 * FIX BUG #2: this.table ahora se asigna en el constructor. Sin esto, las
 * subclases que llaman `super(db, 'tabla')` generaban SQL con FROM undefined
 * y DELETE/UPDATE contra tabla inexistente.
 *
 * FIX R-01 (multi-tenant RLS): el método query() ahora detecta si hay un
 * tenantContext activo (vía AsyncLocalStorage de db.js) y, si lo hay,
 * delega en tenantQuery() para que las policies RLS se activen
 * automáticamente con SET LOCAL app.current_org_id / user_id / user_rol.
 * Si NO hay contexto (modo admin, seeds, /health), cae al pool.query()
 * directo — esas queries no deben tocar tablas con RLS activo.
 *
 * Subclases que usan `this.table`:
 *   class ExpedienteRepository extends BaseRepository {
 *     constructor(db) { super(db, 'expedientes'); }
 *   }
 *
 * Compatibilidad: si una subclase no pasa `table` (p.ej. TokenRepository,
 * MensajeRepository, OrganizacionRepository no tienen `this.table`), el
 * param queda undefined sin romperlas — esas subclases usan SQL literal
 * propio y nunca referencian this.table.
 */
import { tenantContext, tenantQuery } from '../db.js';

export class BaseRepository {
  constructor(pool, table) {
    this.db = pool;
    this.table = table;
  }

  async query(sql, params) {
    // Si hay contexto tenant activo (AsyncLocalStorage), usa tenantQuery()
    // que aplica SET LOCAL para activar las policies RLS multi-tenant.
    // Si NO hay contexto (queries de sistema: /health, seeds, scripts admin,
    // tests que mockean db.js), usa el pool directo sin RLS.
    const hasTenantContext =
      tenantContext && typeof tenantContext.getStore === 'function' && tenantContext.getStore();
    const fn = hasTenantContext
      ? (sql, params) => tenantQuery(sql, params)
      : (sql, params) => this.db.query(sql, params);
    return fn(sql, params);
  }

  async transaction(asyncFn) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await asyncFn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
