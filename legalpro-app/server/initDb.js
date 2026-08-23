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
      // FIX P0-RLS (2026-08-21): NUNCA hacer ENABLE sin POLICY → deny-all para rol app.
      // RLS policies se gestionan vía migración versionada:
      // legalpro-app/server/migrations/2026-08-07-fix-consentimientos-rls.sql
      // y tools/migrations/2026-08-21-fix-p0-rls-force.sql (FORCE RLS).
      // Este patch solo asegura schema; RLS se habilita con policy en migración.
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS consentimientos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK (tipo IN ('terminos', 'privacidad', 'marketing', 'eliminacion', 'transferencia_internacional', 'oposicion')),
            version TEXT NOT NULL DEFAULT '1.0',
            aceptado BOOLEAN NOT NULL DEFAULT TRUE,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_consentimientos_usuario ON consentimientos(usuario_id);
          CREATE INDEX IF NOT EXISTS idx_consentimientos_tipo ON consentimientos(usuario_id, tipo);
          -- RLS: NO habilitar aquí sin POLICY. Ver migración 2026-08-07-fix-consentimientos-rls.sql
          -- ALTER TABLE consentimientos ENABLE ROW LEVEL SECURITY; -- REMOVIDO: debe ir con POLICY + FORCE
        `);
        console.log('[initDb] Tabla consentimientos verificada/creada (RLS delegado a migración versionada).');
      } catch (consentErr) {
        console.error('[initDb] Patch consentimientos ERROR:', consentErr.message);
      }

      // Patch LEG-06: extender CHECK constraint para soportar 'oposicion' (LPDP Art. 27)
      try {
        await db.query(`
          ALTER TABLE consentimientos DROP CONSTRAINT IF EXISTS consentimientos_tipo_check;
          ALTER TABLE consentimientos
            ADD CONSTRAINT consentimientos_tipo_check
            CHECK (tipo IN ('terminos', 'privacidad', 'marketing', 'eliminacion', 'transferencia_internacional', 'oposicion'));
          CREATE INDEX IF NOT EXISTS idx_consentimientos_oposicion
            ON consentimientos(usuario_id, created_at DESC)
            WHERE tipo = 'oposicion';
        `);
        console.log('[initDb] CHECK constraint consentimientos.tipo extendido con oposicion (LEG-06 LPDP Art. 27).');
      } catch (oposicionErr) {
        console.error('[initDb] Patch oposicion ERROR:', oposicionErr.message);
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
      // FIX P0-RLS (2026-08-21): RLS delegado a migración versionada (ver fix-p0-rls-force.sql)
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
          -- ALTER TABLE consumo_tokens_ia ENABLE ROW LEVEL SECURITY; -- REMOVIDO: RLS con FORCE en migración
        `);
        console.log('[initDb] Tabla consumo_tokens_ia e índices verificados/creados (RLS delegado a migración).');
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
          -- ALTER TABLE transacciones_creditos ENABLE ROW LEVEL SECURITY; -- REMOVIDO: RLS con FORCE en migración 2026-08-21-fix-p0-rls-force.sql

          -- Migración schema legacy (init.sql sin expediente_id/tipo/motivo)
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES expedientes(id) ON DELETE SET NULL;
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS tipo TEXT;
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS motivo TEXT;
          UPDATE transacciones_creditos SET motivo = COALESCE(NULLIF(motivo, ''), descripcion, 'Operación')
            WHERE motivo IS NULL OR motivo = '';
          UPDATE transacciones_creditos SET tipo = COALESCE(NULLIF(tipo, ''), tipo_operacion, 'CREDITO')
            WHERE tipo IS NULL OR tipo = '';
          -- [BUG#1 FIX 2026-06-29] precio_pagado / metodo_pago / estado NO EXISTEN en init.sql.
          -- El schema real (init.sql:350-358) solo define:
          --   id, organization_id, usuario_id, cantidad, descripcion, tipo_operacion, created_at
          -- ALTER COLUMN ... SET DEFAULT sobre columnas inexistentes dejaba la DB inconsistente.
          -- Solo referencia_externa queda (idempotente, util para billing/trazabilidad).
          ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS referencia_externa TEXT;
        `);
        console.log('[initDb] Columna creditos_disponibles y tabla transacciones_creditos verificadas/creadas.');
      } catch (creditosErr) {
        console.error('[initDb] Patch creditos ERROR:', creditosErr.message);
      }

      // Patch FIX 2026-08-08 (perf): defensa en profundidad para índices de RAG.
      // Los índices ya se crean en tools/rag/indexer-v2.mjs, pero si el indexer
      // aún no se ejecutó en este entorno, los retrieves híbridos harían
      // sequential scan sobre metadata->>'tipo' = 'jurisprudencia' (lento).
      // Estos CREATE INDEX IF NOT EXISTS son idempotentes y seguros de correr
      // en cada arranque (Postgres detecta el índice existente en <1ms).
      try {
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_rag_vectors_v2_metadata_gin
            ON rag_vectors_v2 USING GIN (metadata jsonb_path_ops);
          CREATE INDEX IF NOT EXISTS idx_rag_vectors_v2_tipo
            ON rag_vectors_v2 ((metadata->>'tipo'));
          CREATE INDEX IF NOT EXISTS idx_rag_vectors_v2_materia
            ON rag_vectors_v2 ((metadata->>'materia'));
        `);
        console.log('[initDb] Índices RAG (rag_vectors_v2 metadata GIN + tipo + materia) verificados/creados.');
      } catch (ragIdxErr) {
        console.error('[initDb] Patch índices RAG ERROR:', ragIdxErr.message);
      }

      // Patch 2026-08-09 (CalendarioVencimientos v6.12.14): tabla para persistir
      // overrides manuales del abogado sobre los vencimientos calculados
      // (drag & drop HTML5 + "Marcar completado"). El GET /api/plazos/vencimientos
      // consume estas filas para SOBRE-ESCRIBIR la fecha_limite calculada y/o
      // marcar el item como completado, sin invalidar la lógica del catálogo.
      //   - Idempotente (CREATE TABLE IF NOT EXISTS): se ejecuta en cada arranque.
      //   - UNIQUE(expediente_id, evento): una sola fila por (expediente, evento).
      //   - RLS multi-tenant: defensa en profundidad (además del WHERE explícito).
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS vencimientos_overrides (
            id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id     UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
            expediente_id       UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
            evento              TEXT        NOT NULL,
            nueva_fecha_limite  DATE        NULL,
            completado          BOOLEAN     NOT NULL DEFAULT FALSE,
            completado_at       TIMESTAMPTZ NULL,
            completado_por      UUID        NULL REFERENCES usuarios(id) ON DELETE SET NULL,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT vencimientos_overrides_unique UNIQUE (expediente_id, evento)
          );
          CREATE INDEX IF NOT EXISTS idx_vencimientos_overrides_org
            ON vencimientos_overrides (organization_id);
          CREATE INDEX IF NOT EXISTS idx_vencimientos_overrides_exp_evento
            ON vencimientos_overrides (expediente_id, evento);
          CREATE INDEX IF NOT EXISTS idx_vencimientos_overrides_org_evento
            ON vencimientos_overrides (organization_id, evento);

          ALTER TABLE vencimientos_overrides ENABLE ROW LEVEL SECURITY;
          ALTER TABLE vencimientos_overrides FORCE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS p_vencimientos_overrides_all ON vencimientos_overrides;
          CREATE POLICY p_vencimientos_overrides_all ON vencimientos_overrides
              FOR ALL
              USING (organization_id = fn_rls_current_org_id())
              WITH CHECK (organization_id = fn_rls_current_org_id());

          COMMENT ON TABLE vencimientos_overrides IS
            'Overrides manuales del abogado sobre vencimientos calculados (drag & drop + completado). CalendarioVencimientos v6.12.14+.';
          COMMENT ON POLICY p_vencimientos_overrides_all ON vencimientos_overrides IS
            'vencimientos_overrides visibles solo para la propia organizacion (multi-tenant)';
        `);
        console.log('[initDb] Tabla vencimientos_overrides + RLS policy verificadas/creadas.');
      } catch (overridesErr) {
        console.error('[initDb] Patch vencimientos_overrides ERROR:', overridesErr.message);
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
