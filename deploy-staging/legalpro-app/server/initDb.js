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
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS email_hash TEXT;
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS datos_anonimizados BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS terminos_aceptados_en TIMESTAMPTZ;
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS terminos_version TEXT DEFAULT '1.0';
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS privacidad_aceptada_en TIMESTAMPTZ;
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS privacidad_version TEXT DEFAULT '1.0';
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;
          ALTER TABLE expedientes
            ADD COLUMN IF NOT EXISTS es_urgente BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE expedientes
            ADD COLUMN IF NOT EXISTS texto_ocr TEXT;
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
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS reset_token TEXT;
          ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;
          -- [2026-08-07] Parche de base_legal_vectorial eliminado: la tabla fue
          -- dropeada de producción (orfanada, 0 filas, sin lectores/escritores).
          ALTER TABLE invitaciones_organizacion
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        `);
        console.log('[initDb] Patches de columnas aplicados (IF NOT EXISTS).');
      } catch (patchErr) {
        console.error('[initDb] Patch columnas ERROR:', patchErr.message);
      }

      // Patch: hacer el check de rol case-insensitive para compatibilidad .NET (PascalCase) / Node (UPPERCASE)
      try {
        // Primero limpiar datos existentes que puedan violar las nuevas constraints
        await db.query(`UPDATE usuarios SET rol = UPPER(TRIM(rol))
          WHERE rol IS NOT NULL AND UPPER(TRIM(rol)) IN ('ABOGADO', 'JUEZ', 'FISCAL', 'CONTADOR', 'ADMIN');`);
        await db.query(`UPDATE miembros_organizacion SET rol = UPPER(TRIM(rol))
          WHERE rol IS NOT NULL AND UPPER(TRIM(rol)) IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');`);
        await db.query(`UPDATE organizaciones SET plan = LOWER(TRIM(plan))
          WHERE plan IS NOT NULL AND LOWER(TRIM(plan)) IN ('free', 'pro', 'enterprise');`);
        // Si hay filas con valores incompatibles, asignar default
        await db.query(`UPDATE organizaciones SET plan = 'free'
          WHERE plan IS NULL OR LOWER(TRIM(plan)) NOT IN ('free', 'pro', 'enterprise');`);

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

      // Patch: tabla consentimientos para trazabilidad legal LPDP/GDPR
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS consentimientos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK (tipo IN ('terminos', 'privacidad', 'marketing', 'eliminacion', 'transferencia_internacional')),
            version TEXT NOT NULL DEFAULT '1.0',
            aceptado BOOLEAN NOT NULL DEFAULT TRUE,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_consentimientos_usuario ON consentimientos(usuario_id);
          CREATE INDEX IF NOT EXISTS idx_consentimientos_tipo ON consentimientos(usuario_id, tipo);
          ALTER TABLE consentimientos ENABLE ROW LEVEL SECURITY;
        `);
        console.log('[initDb] Tabla consentimientos verificada/creada.');
      } catch (consentErr) {
        console.error('[initDb] Patch consentimientos ERROR:', consentErr.message);
      }

      // Patch: columna acepta_transferencia_internacional en consentimientos
      try {
        await db.query(`
          ALTER TABLE consentimientos ADD COLUMN IF NOT EXISTS acepta_transferencia_internacional BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        console.log('[initDb] Columna acepta_transferencia_internacional agregada a consentimientos.');
      } catch (transferErr) {
        console.error('[initDb] Patch transferencia_internacional ERROR:', transferErr.message);
      }

      // Patch: tabla consumo_tokens_ia para auditoría de IA y control de costos
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS consumo_tokens_ia (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id        UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
            tipo_operacion    TEXT        NOT NULL,
            modelo            TEXT        NOT NULL,
            prompt_tokens     INTEGER     NOT NULL DEFAULT 0,
            completion_tokens INTEGER     NOT NULL DEFAULT 0,
            total_tokens      INTEGER     NOT NULL DEFAULT 0,
            costo_usd         NUMERIC(12,8) NOT NULL DEFAULT 0.00000000,
            idempotency_key   TEXT        UNIQUE,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_consumo_tokens_org_created ON consumo_tokens_ia(organization_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_consumo_tokens_usuario ON consumo_tokens_ia(usuario_id);
          ALTER TABLE consumo_tokens_ia ENABLE ROW LEVEL SECURITY;
        `);
        console.log('[initDb] Tabla consumo_tokens_ia e índices verificados/creados.');
      } catch (tokensErr) {
        console.error('[initDb] Patch consumo_tokens_ia ERROR:', tokensErr.message);
      }

      // Patch: creditos_disponibles en organizaciones y tabla transacciones_creditos
      try {
        await db.query(`
          ALTER TABLE organizaciones
            ADD COLUMN IF NOT EXISTS creditos_disponibles INTEGER NOT NULL DEFAULT 100;
          
          CREATE TABLE IF NOT EXISTS transacciones_creditos (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
            usuario_id        UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            expediente_id     UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
            cantidad          INTEGER     NOT NULL,
            tipo              TEXT        NOT NULL CHECK (tipo IN ('DEBITO', 'CREDITO')),
            motivo            TEXT        NOT NULL,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_transacciones_creditos_org ON transacciones_creditos(organization_id);
          CREATE INDEX IF NOT EXISTS idx_transacciones_creditos_user ON transacciones_creditos(usuario_id);
          ALTER TABLE transacciones_creditos ENABLE ROW LEVEL SECURITY;

          -- Migración schema legacy (init.sql sin expediente_id/tipo/motivo)
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES expedientes(id) ON DELETE SET NULL;
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS tipo TEXT;
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS motivo TEXT;
          UPDATE transacciones_creditos SET motivo = COALESCE(NULLIF(motivo, ''), descripcion, 'Operación')
            WHERE motivo IS NULL OR motivo = '';
          UPDATE transacciones_creditos SET tipo = COALESCE(NULLIF(tipo, ''), tipo_operacion, 'CREDITO')
            WHERE tipo IS NULL OR tipo = '';
          ALTER TABLE transacciones_creditos ALTER COLUMN precio_pagado SET DEFAULT 0;
          ALTER TABLE transacciones_creditos ALTER COLUMN metodo_pago SET DEFAULT 'consumo_ia';
          ALTER TABLE transacciones_creditos ALTER COLUMN estado SET DEFAULT 'aprobado';
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS referencia_externa TEXT;
        `);
        console.log('[initDb] Columna creditos_disponibles y tabla transacciones_creditos verificadas/creadas.');
      } catch (creditosErr) {
        console.error('[initDb] Patch creditos ERROR:', creditosErr.message);
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
