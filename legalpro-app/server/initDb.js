/**
 * initDb.js - Diagnostico y auto-inicializacion del schema en Railway PostgreSQL.
 * Ejecutado al arrancar el server. Aplica init.sql si las tablas no existen.
 * Idempotente: usa CREATE TABLE IF NOT EXISTS - seguro ejecutar multiples veces.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dir = dirname(fileURLToPath(import.meta.url));

export async function initDb() {
  try {
    const { rows } = await db.query(
      "SELECT COUNT(*) as n FROM information_schema.tables WHERE table_schema='public' AND table_name='usuarios'"
    );
    const tableExists = parseInt(rows[0].n) > 0;

    if (tableExists) {
      console.log('[initDb] Tabla usuarios encontrada. Aplicando patches de columnas...');

      // Patch: columnas que el backend .NET espera pero que el schema legacy puede no tener
      try {
        await db.query(`
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS es_admin_organizacion BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id) ON DELETE SET NULL;
          ALTER TABLE expedientes
            ADD COLUMN IF NOT EXISTS es_urgente BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE miembros_organizacion
            ADD COLUMN IF NOT EXISTS invitado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;
          ALTER TABLE miembros_organizacion
            ADD COLUMN IF NOT EXISTS invitado_en TIMESTAMPTZ;
          ALTER TABLE miembros_organizacion
            ADD COLUMN IF NOT EXISTS unido_en TIMESTAMPTZ NOT NULL DEFAULT now();
          ALTER TABLE miembros_organizacion
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
          ALTER TABLE refresh_tokens
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
          ALTER TABLE eventos_simulacion
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
          ALTER TABLE mensajes_chat
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
          ALTER TABLE base_legal_vectorial
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
          ALTER TABLE invitaciones_organizacion
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        `);
        console.log('[initDb] Patches de columnas aplicados (IF NOT EXISTS).');
      } catch (patchErr) {
        console.error('[initDb] Patch columnas ERROR:', patchErr.message);
      }

      // Patch: hacer el check de rol case-insensitive para compatibilidad .NET (PascalCase) / Node (UPPERCASE)
      try {
        await db.query(`
          ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
          ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
            CHECK (UPPER(rol) IN ('ABOGADO', 'JUEZ', 'FISCAL', 'CONTADOR', 'ADMIN'));
          ALTER TABLE miembros_organizacion DROP CONSTRAINT IF EXISTS miembros_organizacion_rol_check;
          ALTER TABLE miembros_organizacion ADD CONSTRAINT miembros_organizacion_rol_check
            CHECK (UPPER(rol) IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'));
          ALTER TABLE organizaciones DROP CONSTRAINT IF EXISTS organizaciones_plan_check;
          ALTER TABLE organizaciones ADD CONSTRAINT organizaciones_plan_check
            CHECK (LOWER(plan) IN ('free', 'pro', 'enterprise'));
        `);
        console.log('[initDb] Constraints de rol y plan actualizadas a case-insensitive.');
      } catch (constraintErr) {
        console.error('[initDb] Patch constraints ERROR:', constraintErr.message);
      }

      return;
    }

    console.log('[initDb] Tabla usuarios NO EXISTE. Aplicando schema...');
    await applySchema();
  } catch (err) {
    console.error('[initDb] ERROR general:', err.message);
  }
}

async function applySchema() {
  const candidatos = [
    resolve(__dir, 'init.sql'),
    resolve(__dir, '..', 'docker', 'init.sql'),
  ];

  const sqlPath = candidatos.find(p => existsSync(p));
  if (!sqlPath) {
    console.error('[initDb] No se encontro init.sql en:', candidatos);
    return;
  }

  const sql = readFileSync(sqlPath, 'utf8');
  console.log('[initDb] Aplicando schema desde', sqlPath);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[initDb] Schema aplicado correctamente.');
  } catch (schemaErr) {
    await client.query('ROLLBACK');
    console.error('[initDb] Error aplicando schema:', schemaErr.message);
  } finally {
    client.release();
  }
}
