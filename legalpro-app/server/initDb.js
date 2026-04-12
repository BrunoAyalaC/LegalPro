/**
 * initDb.js — Inicialización automática del schema en Railway PostgreSQL
 * Ejecutado al arrancar el server. Aplica init.sql si las tablas no existen.
 * Idempotente: usa CREATE TABLE IF NOT EXISTS — seguro ejecutar múltiples veces.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dir = dirname(fileURLToPath(import.meta.url));

export async function initDb() {
  try {
    // Verificar si las tablas ya existen
    const { rows } = await db.query(
      "SELECT COUNT(*) as n FROM information_schema.tables WHERE table_schema='public' AND table_name='usuarios'"
    );
    const tableExists = parseInt(rows[0].n) > 0;

    if (tableExists) {
      console.log('[initDb] Tabla usuarios encontrada. Diagnosticando INSERT...');
      
      // Verificar columnas exactas para diagnosticar el problema
      const cols = await db.query(
        `SELECT column_name, data_type FROM information_schema.columns 
         WHERE table_schema='public' AND table_name='usuarios' ORDER BY ordinal_position`
      );
      console.log('[initDb] Columnas de usuarios:', cols.rows.map(c => `${c.column_name}(${c.data_type})`).join(', '));
      
      // Test INSERT para encontrar el error exacto
      try {
        const test = await db.query(
          `INSERT INTO usuarios (nombre_completo, email, password_hash, rol, especialidad, esta_activo)
           VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id`,
          ['_init_test_', '_init_test_@diagpro.pe', '$2b$12$test_hash', 'ABOGADO', 'GENERAL']
        );
        console.log('[initDb] Test INSERT OK → id:', test.rows[0]?.id);
        await db.query('DELETE FROM usuarios WHERE email=$1', ['_init_test_@diagpro.pe']);
        console.log('[initDb] ✅ DB operacional — INSERT/DELETE funciona correctamente.');
      } catch (insertErr) {
        console.error('[initDb] ❌ TEST INSERT FALLÓ:', insertErr.message);
        console.error('[initDb]    Detail:', insertErr.detail);
        console.error('[initDb]    Hint:', insertErr.hint);
        console.error('[initDb]    Code:', insertErr.code);
        
        // Si falla porque falta una columna, aplicar schema completo
        if (insertErr.message.includes('column') || insertErr.message.includes('does not exist')) {
          console.log('[initDb] Intentando aplicar schema completo para corregir columnas faltantes...');
          await applySchema();
        }
      }
      return;
    }

    // Tabla no existe → aplicar schema completo
    console.log('[initDb] Tabla usuarios NO EXISTE. Aplicando schema...');
    await applySchema();

  } catch (err) {
    console.error('[initDb] ERROR general:', err.message);
  }
}

async function applySchema() {
  const candidatos = [
    resolve(__dir, 'init.sql'),                    // En Docker: /app/server/init.sql
    resolve(__dir, '..', 'docker', 'init.sql'),    // En desarrollo: docker/init.sql
  ];

  const sqlPath = candidatos.find(p => existsSync(p));
  if (!sqlPath) {
    console.error('[initDb] No se encontró init.sql en:', candidatos);
    return;
  }

  const sql = readFileSync(sqlPath, 'utf8');
  console.log(`[initDb] Aplicando schema desde ${sqlPath}...`);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[initDb] ✅ Schema aplicado correctamente (init.sql ejecutado).');
  } catch (schemaErr) {
    await client.query('ROLLBACK');
    console.error('[initDb] ❌ Error aplicando schema:', schemaErr.message);
  } finally {
    client.release();
  }
}
  try {
    await client.query(sql);
    console.log('[initDb] ✅ Schema aplicado correctamente.');
  } catch (schemaErr) {
    console.error('[initDb] Error al aplicar schema:', schemaErr.message);
  } finally {
    client.release();
  }
}
