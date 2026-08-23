/**
 * BaseRepository — Clase base para repositorios PostgreSQL.
 * Recibe el pool de conexiones pg y expone métodos de utilidad.
 */
export class BaseRepository {
  constructor(pool) {
    this.db = pool;
  }

  async query(sql, params) {
    return this.db.query(sql, params);
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
