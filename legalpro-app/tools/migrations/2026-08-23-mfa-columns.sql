-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-08-23-mfa-columns.sql — MFA/TOTP (ADR-004-rev1)
--
-- Columnas de autenticación de dos factores (TOTP + códigos de respaldo)
-- sobre la tabla global `usuarios`. Desbloquea el router auth-login-mfa.js
-- que ADR-004 tenía postergado precisamente porque producción no tenía estas
-- columnas (500 en cada login).
--
-- Idempotente: DO blocks con IF NOT EXISTS — seguro ejecutar múltiples veces.
-- Espejo idempotente en server/initDb.js (patch de arranque).
--
-- Nota multi-tenant: `usuarios` es tabla GLOBAL (lookup por email/id), las
-- columnas viven en la fila del usuario y NO requieren RLS por organización.
-- El secreto TOTP es dato sensible de seguridad: NUNCA se expone por API
-- después del setup (solo el otpauth URI una vez, durante el enrolamiento).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Secreto base32 compartido con la app autenticadora (Google Authenticator,
  -- Authy, etc.). NULL hasta que el usuario inicie el enrolamiento.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'mfa_secret'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN mfa_secret TEXT;
  END IF;

  -- Flag maestro: solo cuando TRUE el login exige el segundo factor.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'mfa_enabled'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  -- Códigos de respaldo de un solo uso, almacenados como hashes SHA-256
  -- (TEXT[]). El texto plano se muestra UNA sola vez al activar MFA.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'mfa_backup_codes'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN mfa_backup_codes TEXT[] DEFAULT NULL;
  END IF;

  -- Momento de confirmación del enrolamiento (trazabilidad LPDP/seguridad).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'mfa_enrolled_at'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN mfa_enrolled_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN usuarios.mfa_secret IS
  'Secreto base32 TOTP (MFA). Se guarda en el enrolamiento; nunca se devuelve por API tras el setup.';
COMMENT ON COLUMN usuarios.mfa_enabled IS
  'MFA/TOTP activo: TRUE exige segundo factor en POST /api/auth/login (ADR-004-rev1).';
COMMENT ON COLUMN usuarios.mfa_backup_codes IS
  'Códigos de respaldo MFA de un solo uso como hashes SHA-256 (TEXT[]). Texto plano visible solo al activar.';
COMMENT ON COLUMN usuarios.mfa_enrolled_at IS
  'Fecha de confirmación del enrolamiento MFA (POST /api/auth/mfa/verify).';
