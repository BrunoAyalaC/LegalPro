-- ═══════════════════════════════════════════════════════════════════════
-- 2026-08-21-deleted-at-drift.sql
-- FIX P1: Unifica drift deleted_at vs eliminado_en (clientes, usuarios, organizaciones)
-- + agrega HasColumnName("deleted_at") en EFCore
-- ═══════════════════════════════════════════════════════════════════════
-- HALLAZGO AUDITORÍA DB P1:
--   - .NET Domain: Expediente implementa ISoftDelete con propiedad DeletedAt
--     → EFCore genera query filter ((ISoftDelete)e).DeletedAt == null
--     → Espera columna "DeletedAt" (o "deleted_at" si snake_case)
--   - init.sql: expedientes usa deleted_at (correcto), pero
--     clientes usa eliminado_en, usuarios usa eliminado_en (drift),
--     organizaciones no tiene deleted_at en absoluto
--   - EntityConfigurations.cs no tiene .HasColumnName("deleted_at") para
--     Usuario/Organizacion, entonces EFCore busca "DeletedAt" que no existe
--   - Node: legalpro-app/server/init.sql litigios usan ambos:
--     clientes.eliminado_en, usuarios.eliminado_en, expedientes.deleted_at
--   - Esto rompe filtros globales y queries: Node filtra eliminado_en,
--     .NET filtra DeletedAt → inconsistencia, soft-delete no funciona cross-stack
--
-- FIX:
--   1. Renombrar clientes.eliminado_en → deleted_at (si existe)
--   2. Renombrar usuarios.eliminado_en → deleted_at, mantener eliminado_en como alias
--      vía vista o columna generada? Preferimos renombrar y agregar vista de compat
--      + trigger sync para no romper Node que aún usa eliminado_en.
--   3. Agregar organizaciones.deleted_at si no existe (para Owner soft-delete)
--   4. Agregar índices parciales WHERE deleted_at IS NULL
--   5. Documentar que EFCore EntityConfigurations.cs debe usar .HasColumnName("deleted_at")
--      (el fix real está en ese archivo, aquí solo DB)
--   6. Trigger de sync eliminado_en <-> deleted_at para compat transición
--
-- CONVENCIONES:
--   - Toda tabla tenant DEBE tener deleted_at TIMESTAMPTZ NULL (soft-delete)
--   - RLS policies ya existen, no se tocan aquí
--   - Retención/purga: fn_cleanup_old_audit_log no afecta soft-delete; purga
--     de soft-deletes es vía DELETE físico tras 2 años (ver retention policy)
--
-- BASE LEGAL:
--   - LPDP Art. 27 oposición + Art. 20 caducidad
--   - .opencode/rules/sql-postgres.md: TODA tabla DEBE tener deleted_at
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PASO 1: clientes.eliminado_en → deleted_at
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='eliminado_en'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='deleted_at'
  ) THEN
    ALTER TABLE clientes RENAME COLUMN eliminado_en TO deleted_at;
    RAISE NOTICE 'clientes: eliminado_en → deleted_at renombrado';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='eliminado_en'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='deleted_at'
  ) THEN
    RAISE WARNING 'clientes tiene ambas columnas eliminado_en y deleted_at — requiere sync manual';
    -- Sincronizar: copiar no NULL de eliminado_en a deleted_at donde deleted_at IS NULL
    UPDATE clientes SET deleted_at = eliminado_en WHERE deleted_at IS NULL AND eliminado_en IS NOT NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='deleted_at'
  ) THEN
    ALTER TABLE clientes ADD COLUMN deleted_at TIMESTAMPTZ;
    RAISE NOTICE 'clientes: deleted_at agregado (no existía)';
  ELSE
    RAISE NOTICE 'clientes: deleted_at ya existe, sin cambios';
  END IF;
END $$;

-- Compat: si Node aún usa eliminado_en, crear alias vía columna generada? En PG no se puede
-- alias sin duplicar. Mejor mantener eliminado_en como columna real sincronizada vía trigger
-- si existía previamente. Si ya renombramos, recrear eliminado_en como columna sincronizada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='eliminado_en'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='deleted_at'
  ) THEN
    -- Recrear eliminado_en como columna real para compat Node (mientras se migra código)
    ALTER TABLE clientes ADD COLUMN eliminado_en TIMESTAMPTZ;
    UPDATE clientes SET eliminado_en = deleted_at;
    RAISE NOTICE 'clientes: eliminado_en recreada como alias de deleted_at para compat Node';
  END IF;
END $$;

-- Trigger sync clientes.deleted_at <-> eliminado_en (bidireccional)
CREATE OR REPLACE FUNCTION fn_clientes_sync_deleted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL AND NEW.eliminado_en IS NULL THEN
      NEW.eliminado_en := NEW.deleted_at;
    ELSIF NEW.eliminado_en IS NOT NULL AND NEW.deleted_at IS NULL THEN
      NEW.deleted_at := NEW.eliminado_en;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      NEW.eliminado_en := NEW.deleted_at;
    ELSIF NEW.eliminado_en IS DISTINCT FROM OLD.eliminado_en THEN
      NEW.deleted_at := NEW.eliminado_en;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_deleted_at_sync ON clientes;
CREATE TRIGGER trg_clientes_deleted_at_sync
  BEFORE INSERT OR UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_clientes_sync_deleted_at();

-- ─────────────────────────────────────────────────────────────────
-- PASO 2: usuarios.eliminado_en → deleted_at
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='eliminado_en'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='deleted_at'
  ) THEN
    ALTER TABLE usuarios RENAME COLUMN eliminado_en TO deleted_at;
    RAISE NOTICE 'usuarios: eliminado_en → deleted_at renombrado';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='eliminado_en'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='deleted_at'
  ) THEN
    UPDATE usuarios SET deleted_at = eliminado_en WHERE deleted_at IS NULL AND eliminado_en IS NOT NULL;
    RAISE WARNING 'usuarios tiene ambas columnas — sincronizadas donde posible';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='deleted_at'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN deleted_at TIMESTAMPTZ;
    RAISE NOTICE 'usuarios: deleted_at agregado';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='eliminado_en'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='deleted_at'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN eliminado_en TIMESTAMPTZ;
    UPDATE usuarios SET eliminado_en = deleted_at;
    RAISE NOTICE 'usuarios: eliminado_en recreada como alias para compat Node';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_usuarios_sync_deleted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL AND NEW.eliminado_en IS NULL THEN
      NEW.eliminado_en := NEW.deleted_at;
    ELSIF NEW.eliminado_en IS NOT NULL AND NEW.deleted_at IS NULL THEN
      NEW.deleted_at := NEW.eliminado_en;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      NEW.eliminado_en := NEW.deleted_at;
    ELSIF NEW.eliminado_en IS DISTINCT FROM OLD.eliminado_en THEN
      NEW.deleted_at := NEW.eliminado_en;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_deleted_at_sync ON usuarios;
CREATE TRIGGER trg_usuarios_deleted_at_sync
  BEFORE INSERT OR UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_usuarios_sync_deleted_at();

-- ─────────────────────────────────────────────────────────────────
-- PASO 3: organizaciones.deleted_at
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ; -- alias para compat si algún código lo usa

-- Sync también para organizaciones (parcial, por si se usa eliminado_en)
CREATE OR REPLACE FUNCTION fn_organizaciones_sync_deleted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL AND NEW.eliminado_en IS NULL THEN
      NEW.eliminado_en := NEW.deleted_at;
    ELSIF NEW.eliminado_en IS NOT NULL AND NEW.deleted_at IS NULL THEN
      NEW.deleted_at := NEW.eliminado_en;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      NEW.eliminado_en := NEW.deleted_at;
    ELSIF NEW.eliminado_en IS DISTINCT FROM OLD.eliminado_en THEN
      NEW.deleted_at := NEW.eliminado_en;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organizaciones_deleted_at_sync ON organizaciones;
CREATE TRIGGER trg_organizaciones_deleted_at_sync
  BEFORE INSERT OR UPDATE ON organizaciones
  FOR EACH ROW EXECUTE FUNCTION fn_organizaciones_sync_deleted_at();

UPDATE organizaciones SET eliminado_en = deleted_at WHERE eliminado_en IS NULL AND deleted_at IS NOT NULL;
UPDATE organizaciones SET deleted_at = eliminado_en WHERE deleted_at IS NULL AND eliminado_en IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 4: Índices parciales WHERE deleted_at IS NULL (hot paths)
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_deleted_at ON clientes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_deleted_at ON usuarios(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_org_deleted ON usuarios(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizaciones_deleted_at ON organizaciones(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expedientes_deleted_at ON expedientes(deleted_at) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- PASO 5: Comentarios y verificación
-- ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN clientes.deleted_at IS 'Soft-delete canónico (renombrado de eliminado_en 2026-08-21). Sincronizado vía trigger con eliminado_en para compat Node.';
COMMENT ON COLUMN usuarios.deleted_at IS 'Soft-delete canónico (renombrado de eliminado_en 2026-08-21). .NET ISoftDelete.DeletedAt mapea aquí vía HasColumnName("deleted_at").';
COMMENT ON COLUMN organizaciones.deleted_at IS 'Soft-delete para Owner suspension (RB-020). Sincronizado con eliminado_en. EFCore HasColumnName("deleted_at").';
COMMENT ON TABLE organizaciones IS 'Tenant root: cada organizacion es un espacio aislado. Soft-delete via deleted_at (Owner).';

-- Verificación
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('clientes','usuarios','organizaciones','expedientes')
  AND column_name IN ('deleted_at','eliminado_en')
ORDER BY table_name, column_name;

SELECT
  c.relname AS tabla,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name=c.relname AND column_name='deleted_at') AS tiene_deleted_at,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND tablename=c.relname AND indexdef LIKE '%deleted_at%') AS num_indices_deleted
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('clientes','usuarios','organizaciones','expedientes')
ORDER BY c.relname;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- NOTA PARA EFCore (EntityConfigurations.cs):
-- ═══════════════════════════════════════════════════════════════════════
-- Agregar en UsuarioConfiguration y OrganizacionConfiguration:
--   builder.Property(e => e.DeletedAt).HasColumnName("deleted_at");
-- Para Expediente ya está correcto (deleted_at en init.sql).
-- Para Usuario/Organizacion, si la entidad implementa ISoftDelete, agregar:
--   builder.Property<DateTime?>("DeletedAt").HasColumnName("deleted_at");
-- O mapear propiedad DeletedAt directamente si existe en la entidad.
-- Ver archivo EntityConfigurations.cs editado en paralelo (2026-08-21).
-- ═══════════════════════════════════════════════════════════════════════
