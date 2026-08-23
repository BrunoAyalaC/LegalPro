import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

describe('Trigger trg_evidencia_inmutable', () => {
  let pool;
  let testDbAvailable = false;

  beforeAll(async () => {
    if (process.env.DATABASE_URL) {
      pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: false,
      });
      try {
        await pool.query('SELECT 1');
        testDbAvailable = true;
      } catch (err) {
        console.warn('DB no disponible para pruebas de trigger:', err.message);
      }
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('debe rechazar UPDATE y DELETE sobre la tabla evidencia_digital', async () => {
    if (!testDbAvailable) {
      console.log('Skipping real trigger test as DB is not available');
      return;
    }

    const orgId = '00000000-0000-0000-0000-000000000099';
    await pool.query(`
      INSERT INTO organizaciones (id, nombre, slug)
      VALUES ($1, 'Org Test Trigger', 'org-test-trigger')
      ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
    `, [orgId]);

    const evidenciaId = '00000000-0000-0000-0000-000000000098';
    await pool.query(`
      INSERT INTO evidencia_digital (id, organization_id, nombre_original, tipo_archivo, tamano_bytes, hash_sha256, storage_path)
      VALUES ($1, $2, 'test.txt', 'text/plain', 123, 'hash_test_trigger_123', '/path/test.txt')
      ON CONFLICT (hash_sha256) DO NOTHING
    `, [evidenciaId, orgId]);

    // Intentar UPDATE -> debe fallar
    try {
      await pool.query(`
        UPDATE evidencia_digital
        SET nombre_original = 'test_updated.txt'
        WHERE id = $1
      `, [evidenciaId]);
      throw new Error('UPDATE debió fallar pero se ejecutó correctamente');
    } catch (err) {
      expect(err.message).toContain('Las evidencias registradas en la bóveda digital son inmutables por ley.');
    }

    // Intentar DELETE -> debe fallar
    try {
      await pool.query(`
        DELETE FROM evidencia_digital
        WHERE id = $1
      `, [evidenciaId]);
      throw new Error('DELETE debió fallar pero se ejecutó correctamente');
    } catch (err) {
      expect(err.message).toContain('Las evidencias registradas en la bóveda digital son inmutables por ley.');
    }

    // Limpieza
    try {
      await pool.query('DROP TRIGGER IF EXISTS trg_evidencia_inmutable ON evidencia_digital');
      await pool.query('DELETE FROM evidencia_digital WHERE id = $1', [evidenciaId]);
      await pool.query('DELETE FROM organizaciones WHERE id = $1', [orgId]);
      await pool.query(`
        CREATE TRIGGER trg_evidencia_inmutable
        BEFORE UPDATE OR DELETE ON evidencia_digital
        FOR EACH ROW EXECUTE FUNCTION fn_evidencia_inmutable();
      `);
    } catch (cleanupErr) {
      console.warn('Error durante la limpieza del test de trigger:', cleanupErr.message);
    }
  });
});
