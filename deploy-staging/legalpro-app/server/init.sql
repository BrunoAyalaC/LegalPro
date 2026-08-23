-- =============================================================================
-- LegalPro - Esquema unificado para Railway PostgreSQL
-- =============================================================================
-- Combina: EF Core .NET tables + modulos legales (Node backend)
-- SIN dependencias de Supabase Auth (auth.uid, auth.users, RLS)
-- Railway provee DATABASE_URL con acceso directo a este esquema
-- Version: 1.0.0 | Fecha: 2026-04-10
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- FUNCION TRIGGER: updated_at automatico
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- PRE-MIGRACIONES: Renombrado de columnas obsoletas / incompatibles
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema='public' AND table_name='invitaciones_organizacion'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='invitaciones_organizacion' AND column_name='organizacion_id'
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='invitaciones_organizacion' AND column_name='organization_id'
        ) THEN
            EXECUTE 'ALTER TABLE invitaciones_organizacion RENAME COLUMN organizacion_id TO organization_id';
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='invitaciones_organizacion' AND column_name='es_aceptada'
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='invitaciones_organizacion' AND column_name='esta_aceptada'
        ) THEN
            EXECUTE 'ALTER TABLE invitaciones_organizacion RENAME COLUMN es_aceptada TO esta_aceptada';
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='invitaciones_organizacion' AND column_name='fecha_expiracion'
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='invitaciones_organizacion' AND column_name='expira_at'
        ) THEN
            EXECUTE 'ALTER TABLE invitaciones_organizacion RENAME COLUMN fecha_expiracion TO expira_at';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema='public' AND table_name='transacciones_creditos'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='transacciones_creditos' AND column_name='cantidad_creditos'
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='transacciones_creditos' AND column_name='cantidad'
        ) THEN
            EXECUTE 'ALTER TABLE transacciones_creditos RENAME COLUMN cantidad_creditos TO cantidad';
        END IF;
    END IF;
END $$;

-- =============================================================================
-- SECCION 1: TABLAS CORE (EF Core .NET Backend)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLA: organizaciones (Tenant root)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizaciones (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre            TEXT        NOT NULL,
    slug              TEXT        UNIQUE NOT NULL,
    plan              TEXT        NOT NULL DEFAULT 'free'
                                  CHECK (plan IN ('free', 'pro', 'enterprise')),
    max_usuarios      INT         NOT NULL DEFAULT 5,
    max_expedientes   INT         NOT NULL DEFAULT 50,
    activo            BOOLEAN     NOT NULL DEFAULT TRUE,
    storage_gb_limit  NUMERIC(10,2) DEFAULT 1.0,
    creditos_disponibles INTEGER     DEFAULT 150,
    plan_suscripcion     VARCHAR(50) DEFAULT 'basico',
    config            JSONB       NOT NULL DEFAULT '{}',
    metadata          JSONB       NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE organizaciones IS 'Tenant root: cada organizacion es un espacio aislado (estudio juridico, fiscalia, juzgado)';

DROP TRIGGER IF EXISTS trg_organizaciones_updated_at ON organizaciones;
CREATE TRIGGER trg_organizaciones_updated_at
    BEFORE UPDATE ON organizaciones
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_organizaciones_slug ON organizaciones(slug);
CREATE INDEX IF NOT EXISTS idx_organizaciones_activo ON organizaciones(activo);

-- -----------------------------------------------------------------------------
-- TABLA: usuarios (Auth propio - reemplaza Supabase Auth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id                                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email                                   TEXT        NOT NULL UNIQUE,
    nombre_completo                         TEXT        NOT NULL,
    password_hash                           TEXT        NOT NULL,
    rol                                     TEXT        NOT NULL DEFAULT 'ABOGADO'
                                            CHECK (rol IN ('ABOGADO', 'JUEZ', 'FISCAL', 'CONTADOR', 'ADMIN')),
    especialidad                            TEXT        DEFAULT 'GENERAL',
    esta_activo                             BOOLEAN     NOT NULL DEFAULT TRUE,
    organization_id                         UUID        REFERENCES organizaciones(id) ON DELETE SET NULL,
    acepta_transferencia_internacional      BOOLEAN     NOT NULL DEFAULT FALSE,
    consentimiento_transferencia_internacional BOOLEAN     NOT NULL DEFAULT FALSE,
    transferencia_internacional_aceptada_en TIMESTAMPTZ,
    created_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                              TIMESTAMPTZ
);

COMMENT ON TABLE  usuarios              IS 'Usuarios del sistema con auth propio (JWT + bcrypt)';
COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt de la contrasena (cost=12)';
COMMENT ON COLUMN usuarios.rol          IS 'Rol principal: ABOGADO | JUEZ | FISCAL | CONTADOR | ADMIN';

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_esta_activo ON usuarios(esta_activo);

-- -----------------------------------------------------------------------------
-- TABLA: miembros_organizacion (Multi-tenancy linking table)
-- Usada por EF Core .NET backend - nombre canonico del proyecto
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS miembros_organizacion (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    usuario_id        UUID        NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    rol               TEXT        NOT NULL DEFAULT 'MEMBER'
                                  CHECK (rol IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    activo            BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organizacion_id, usuario_id)
);

COMMENT ON TABLE miembros_organizacion IS 'Membresia de usuarios en organizaciones (multi-tenant)';
COMMENT ON COLUMN miembros_organizacion.rol IS 'OWNER | ADMIN | MEMBER | VIEWER';

CREATE INDEX IF NOT EXISTS ix_miembros_organizacion_usuario_id ON miembros_organizacion(usuario_id);
CREATE INDEX IF NOT EXISTS ix_miembros_organizacion_organizacion_id_usuario_id ON miembros_organizacion(organizacion_id, usuario_id);

-- -----------------------------------------------------------------------------
-- TABLA: refresh_tokens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token             TEXT        NOT NULL UNIQUE,
    usuario_id        UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expires_at        TIMESTAMPTZ NOT NULL,
    revocado          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario_id ON refresh_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_revocado ON refresh_tokens(expires_at, revocado);

-- -----------------------------------------------------------------------------
-- TABLA: consentimientos (trazabilidad legal LPDP/GDPR)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consentimientos (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo              TEXT        NOT NULL CHECK (tipo IN ('terminos', 'privacidad', 'marketing', 'eliminacion')),
    version           TEXT        NOT NULL DEFAULT '1.0',
    aceptado          BOOLEAN     NOT NULL DEFAULT TRUE,
    ip_address        INET,
    user_agent        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consentimientos_usuario ON consentimientos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_tipo ON consentimientos(usuario_id, tipo);

-- -----------------------------------------------------------------------------
-- TABLA: expedientes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expedientes (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id                  UUID        REFERENCES usuarios(id) ON DELETE RESTRICT,
    organization_id             UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    numero                      TEXT        NOT NULL UNIQUE,
    titulo                      TEXT        NOT NULL,
    tipo                        TEXT        DEFAULT 'civil'
                                  CHECK (tipo IN ('penal', 'civil', 'laboral', 'constitucional', 'familia', 'administrativo')),
    estado                      TEXT        DEFAULT 'activo'
                                  CHECK (estado IN ('activo', 'archivado', 'cerrado', 'suspendido')),
    juzgado                     TEXT,
    partes                      JSONB       DEFAULT '{}',
    hechos                      TEXT,
    teoria_caso                 TEXT,
    materia                     TEXT,
    tipo_proceso                TEXT,
    numero_expediente           TEXT,
    es_urgente                  BOOLEAN     NOT NULL DEFAULT FALSE,
    es_dato_sensible            BOOLEAN     NOT NULL DEFAULT FALSE,
    contenido_sensible_detectado BOOLEAN    NOT NULL DEFAULT FALSE,
    metadata_sensibilidad       JSONB       NOT NULL DEFAULT '{}',
    deleted_at                  TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ
);

COMMENT ON TABLE expedientes IS 'Expedientes judiciales - nucleo del sistema legal';

DROP TRIGGER IF EXISTS trg_expedientes_updated_at ON expedientes;
CREATE TRIGGER trg_expedientes_updated_at
    BEFORE UPDATE ON expedientes
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_expedientes_org_estado ON expedientes(organization_id, estado);
CREATE INDEX IF NOT EXISTS idx_expedientes_org_created ON expedientes(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expedientes_usuario_id ON expedientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_numero ON expedientes(numero);
CREATE INDEX IF NOT EXISTS idx_expedientes_materia ON expedientes(materia);

-- -----------------------------------------------------------------------------
-- TABLA: simulaciones (Simulador de juicios IA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulaciones (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id              UUID        REFERENCES usuarios(id) ON DELETE RESTRICT,
    organization_id         UUID        REFERENCES organizaciones(id) ON DELETE CASCADE,
    rama_derecho            TEXT        DEFAULT 'CIVIL',
    rol_usuario             TEXT,
    dificultad_modificador  TEXT,
    contexto_sintetico      TEXT,
    tipo                    TEXT,
    materia                 TEXT,
    caso_generado           JSONB       DEFAULT '{}',
    puntaje_final           NUMERIC,
    estado                  TEXT        DEFAULT 'en_progreso',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_simulaciones_updated_at ON simulaciones;
CREATE TRIGGER trg_simulaciones_updated_at
    BEFORE UPDATE ON simulaciones
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_simulaciones_org ON simulaciones(organization_id);
CREATE INDEX IF NOT EXISTS idx_simulaciones_usuario_id ON simulaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_simulaciones_estado ON simulaciones(estado);

-- -----------------------------------------------------------------------------
-- TABLA: eventos_simulacion
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos_simulacion (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    simulacion_id     UUID        NOT NULL REFERENCES simulaciones(id) ON DELETE CASCADE,
    organization_id   UUID        REFERENCES organizaciones(id) ON DELETE CASCADE,
    turno             INTEGER     NOT NULL,
    rol               TEXT,
    emisor            TEXT,
    contenido         TEXT,
    mensaje           TEXT,
    leyes_invocadas   TEXT,
    puntaje           NUMERIC,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_simulacion_simulacion_id ON eventos_simulacion(simulacion_id);
CREATE INDEX IF NOT EXISTS idx_eventos_simulacion_org ON eventos_simulacion(organization_id);

-- -----------------------------------------------------------------------------
-- TABLA: mensajes_chat (Chat IA contextual)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensajes_chat (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID        REFERENCES usuarios(id) ON DELETE CASCADE,
    organization_id   UUID        REFERENCES organizaciones(id) ON DELETE CASCADE,
    expediente_id     UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
    contenido         TEXT        NOT NULL,
    rol               TEXT        NOT NULL DEFAULT 'user'
                                  CHECK (rol IN ('user', 'assistant', 'system')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_usuario_id ON mensajes_chat(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_org ON mensajes_chat(organization_id);

-- -----------------------------------------------------------------------------
-- TABLA: base_legal_vectorial (Jurisprudencia para busqueda semantica)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS base_legal_vectorial (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_normativa  TEXT,
    articulo          TEXT,
    texto_literal     TEXT,
    tipo_norma        TEXT,
    jurisdiccion      TEXT        DEFAULT 'PERU',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_base_legal_tipo ON base_legal_vectorial(tipo_norma);

-- -----------------------------------------------------------------------------
-- TABLA: invitaciones_organizacion
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitaciones_organizacion (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    email             TEXT        NOT NULL,
    rol               TEXT        NOT NULL DEFAULT 'ABOGADO'
                                  CHECK (rol IN ('ABOGADO', 'FISCAL', 'JUEZ', 'CONTADOR', 'ADMIN')),
    token             TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    esta_aceptada     BOOLEAN     NOT NULL DEFAULT FALSE,
    invitado_por      UUID        REFERENCES usuarios(id),
    expira_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    aceptada_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_org ON invitaciones_organizacion(organization_id);

-- -----------------------------------------------------------------------------
-- TABLA: transacciones_creditos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transacciones_creditos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    cantidad INTEGER NOT NULL, -- Positivo (compra/recarga mensual) o Negativo (consumo de IA)
    descripcion VARCHAR(255) NOT NULL,
    tipo_operacion VARCHAR(50) NOT NULL, -- 'recarga_mensual', 'compra_bolsa', 'consumo_ia_panel'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transacciones_creditos_org ON transacciones_creditos(organization_id);

-- =============================================================================
-- SECCION 2: MODULOS LEGALES (Node Backend)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLA: documentos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id               UUID        REFERENCES expedientes(id) ON DELETE CASCADE,
    usuario_id                  UUID        REFERENCES usuarios(id),
    organization_id             UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    nombre                      TEXT        NOT NULL,
    tipo_documento              TEXT        NOT NULL,
    descripcion                 TEXT,
    archivo_url                 TEXT,
    archivo_nombre              TEXT,
    archivo_tipo                TEXT,
    archivo_tamano              BIGINT,
    hash_sha256                 TEXT,
    etiquetas                   TEXT[]      DEFAULT '{}',
    relacionado_con             UUID        REFERENCES documentos(id),
    fecha_documento             DATE,
    es_dato_sensible            BOOLEAN     NOT NULL DEFAULT FALSE,
    contenido_sensible_detectado BOOLEAN    NOT NULL DEFAULT FALSE,
    metadata_sensibilidad       JSONB       NOT NULL DEFAULT '{}',
    creado_en                   TIMESTAMPTZ DEFAULT now(),
    actualizado_en              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_expediente_id ON documentos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_organization_id ON documentos(organization_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_etiquetas ON documentos USING gin(etiquetas);

-- -----------------------------------------------------------------------------
-- TABLA: notificaciones_sinoe
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones_sinoe (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id            UUID        REFERENCES usuarios(id),
    organization_id       UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    expediente_numero     TEXT        NOT NULL,
    tipo_notificacion     TEXT        NOT NULL,
    titulo                TEXT        NOT NULL,
    contenido             TEXT,
    fecha_notificacion    TIMESTAMPTZ NOT NULL,
    leida                 BOOLEAN     DEFAULT FALSE,
    analisis_ia           JSONB,
    urgencia              TEXT        DEFAULT 'media'
                                      CHECK (urgencia IN ('alta', 'media', 'baja')),
    creado_en             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha ON notificaciones_sinoe(usuario_id, fecha_notificacion DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_organization_id ON notificaciones_sinoe(organization_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones_sinoe(usuario_id, leida);

-- -----------------------------------------------------------------------------
-- TABLA: evidencia_digital (Boveda de evidencia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidencia_digital (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID        REFERENCES usuarios(id),
    organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    expediente_id     UUID        REFERENCES expedientes(id),
    nombre_original   TEXT        NOT NULL,
    tipo_archivo      TEXT        NOT NULL,
    tamano_bytes      BIGINT      NOT NULL,
    hash_sha256       TEXT        NOT NULL UNIQUE,
    storage_path      TEXT        NOT NULL,
    descripcion       TEXT,
    etiqueta          TEXT,
    cadena_custodia   JSONB       NOT NULL DEFAULT '[]',
    creado_en         TIMESTAMPTZ DEFAULT now(),
    modificado_en     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidencia_expediente_id ON evidencia_digital(expediente_id);
CREATE INDEX IF NOT EXISTS idx_evidencia_organization_id ON evidencia_digital(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidencia_hash ON evidencia_digital(hash_sha256);

-- Trigger de inmutabilidad para evidencia_digital
CREATE OR REPLACE FUNCTION fn_evidencia_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Las evidencias registradas en la bóveda digital son inmutables por ley.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidencia_inmutable ON evidencia_digital;
CREATE TRIGGER trg_evidencia_inmutable
    BEFORE UPDATE OR DELETE ON evidencia_digital
    FOR EACH ROW EXECUTE FUNCTION fn_evidencia_inmutable();

-- -----------------------------------------------------------------------------
-- TABLA: audit_log (Trazabilidad inmutable multi-tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id                BIGSERIAL   PRIMARY KEY,
    organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    usuario_id        UUID        REFERENCES usuarios(id),
    tabla             TEXT        NOT NULL,
    operacion         TEXT        NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registro_id       TEXT        NOT NULL,
    datos_anteriores  JSONB,
    datos_nuevos      JSONB,
    ip_address        INET,
    user_agent        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_tabla ON audit_log(organization_id, tabla, operacion);

-- -------------------------------------------------------------------------------------------------------------
-- MIGRACIONES DE ACTUALIZACION DE COLUMNAS (Asegura compatibilidad con DB existente)
-- -----------------------------------------------------------------------------
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS storage_gb_limit NUMERIC(10,2) DEFAULT 1.0;
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS creditos_disponibles INTEGER DEFAULT 150;
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS plan_suscripcion VARCHAR(50) DEFAULT 'basico';
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}';

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acepta_transferencia_internacional BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS consentimiento_transferencia_internacional BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS transferencia_internacional_aceptada_en TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizaciones(id) ON DELETE SET NULL;

-- Consentimiento, trazabilidad LPDP, administración y recuperación de contraseña
-- (columnas usadas por el backend Node: auth.js, datos-personales.js, jwt.js).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_admin_organizacion BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_hash            TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS datos_anonimizados    BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terminos_aceptados_en TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terminos_version      TEXT        DEFAULT '1.0';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS privacidad_aceptada_en TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS privacidad_version    TEXT        DEFAULT '1.0';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminado_en          TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token           TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expiry    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_org_rol ON usuarios(organization_id, rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_reset_token ON usuarios(reset_token) WHERE reset_token IS NOT NULL;

COMMENT ON COLUMN usuarios.acepta_transferencia_internacional IS 'Consentimiento expreso para transferencia de datos a proveedores cloud extranjeros (Art. 21 LPDP)';
COMMENT ON COLUMN usuarios.transferencia_internacional_aceptada_en IS 'Timestamp de aceptacion del consentimiento para transferencia internacional';
COMMENT ON COLUMN usuarios.consentimiento_transferencia_internacional IS 'Consentimiento explicito para transferencia internacional de datos personales (Art. 21 LPDP)';

ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS es_dato_sensible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS contenido_sensible_detectado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS metadata_sensibilidad JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN expedientes.es_dato_sensible IS 'Flag: TRUE si el expediente contiene datos sensibles segun LPDP (salud, ideologia, origen racial, etc.)';
COMMENT ON COLUMN expedientes.contenido_sensible_detectado IS 'TRUE si la deteccion automatica identifico posibles datos sensibles en hechos/teoria_caso';
COMMENT ON COLUMN expedientes.metadata_sensibilidad IS 'Metadata JSON con detalles de la deteccion de datos sensibles: {detectado_en, patrones, severidad}';

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS es_dato_sensible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS contenido_sensible_detectado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS metadata_sensibilidad JSONB NOT NULL DEFAULT '{}';

ALTER TABLE invitaciones_organizacion ADD COLUMN IF NOT EXISTS esta_aceptada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invitaciones_organizacion ADD COLUMN IF NOT EXISTS aceptada_at TIMESTAMPTZ;
ALTER TABLE invitaciones_organizacion ADD COLUMN IF NOT EXISTS invitado_por UUID REFERENCES usuarios(id);
ALTER TABLE invitaciones_organizacion ADD COLUMN IF NOT EXISTS expira_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days');

-- Migracion para transacciones_creditos (asegurar campos requeridos)
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id);
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 0;
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS descripcion VARCHAR(255) DEFAULT '';
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS tipo_operacion VARCHAR(50) DEFAULT 'recarga_mensual';
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES expedientes(id) ON DELETE SET NULL;
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS motivo TEXT;

-- Outbox pattern (transactional outbox). Debe coincidir con la entidad EF OutboxMessage.
CREATE TABLE IF NOT EXISTS outbox_messages (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    type              VARCHAR(255) NOT NULL,
    content           TEXT         NOT NULL,
    occurred_on_utc   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    processed_on_utc  TIMESTAMPTZ,
    error             TEXT,
    retry_count       INTEGER      NOT NULL DEFAULT 0
);

-- Outbox pattern: columna de reintentos para exponential backoff (idempotente)
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS ix_outbox_messages_processed_on_utc ON outbox_messages(processed_on_utc);
CREATE INDEX IF NOT EXISTS ix_outbox_messages_pending ON outbox_messages(processed_on_utc, retry_count)
    WHERE processed_on_utc IS NULL AND retry_count < 3;

CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON invitaciones_organizacion(token) WHERE esta_aceptada = FALSE;

-- =============================================================================
-- SECCION 3: FUNCION DE VALIDACION DE LIMITES DE PLAN
-- =============================================================================
CREATE OR REPLACE FUNCTION check_plan_limits(
    p_organization_id UUID,
    p_recurso         TEXT        -- 'usuario' | 'expediente'
)
RETURNS JSONB AS $$
DECLARE
    v_org       organizaciones%ROWTYPE;
    v_actual    INT;
    v_limite    INT;
BEGIN
    SELECT * INTO v_org
    FROM organizaciones
    WHERE id = p_organization_id AND activo = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('puede', FALSE, 'motivo', 'Organizacion no encontrada o inactiva');
    END IF;

    IF p_recurso = 'usuario' THEN
        SELECT COUNT(*) INTO v_actual FROM usuarios WHERE organization_id = p_organization_id;
        v_limite := v_org.max_usuarios;
    ELSIF p_recurso = 'expediente' THEN
        SELECT COUNT(*) INTO v_actual FROM expedientes WHERE organization_id = p_organization_id;
        v_limite := v_org.max_expedientes;
    ELSE
        RETURN jsonb_build_object('puede', FALSE, 'motivo', 'Recurso no reconocido: use usuario o expediente');
    END IF;

    RETURN jsonb_build_object(
        'puede',   v_actual < v_limite,
        'actual',  v_actual,
        'limite',  v_limite,
        'motivo',  CASE WHEN v_actual < v_limite
                       THEN 'OK'
                       ELSE format('Limite de %s alcanzado (%s/%s) para plan %s', p_recurso, v_actual, v_limite, v_org.plan)
                   END
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- SECCION 4: DATOS SEMILLA (Demo para arranque en Railway)
-- =============================================================================

-- Organizacion demo
INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, activo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Estudio Juridico Demo',
    'estudio-demo',
    'pro',
    15,
    200,
    TRUE
) ON CONFLICT (slug) DO NOTHING;

-- Usuario admin demo (password: Admin2024! -> bcrypt cost=12)
INSERT INTO usuarios (id, email, nombre_completo, password_hash, rol, especialidad, esta_activo, organization_id)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'admin@legalpro.pe',
    'Administrador LegalPro',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewhOLzQxE1iH7bvi',
    'ADMIN',
    'GENERAL',
    TRUE,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (email) DO NOTHING;

-- Usuario abogado demo (password: Abogado2024!)
INSERT INTO usuarios (id, email, nombre_completo, password_hash, rol, especialidad, esta_activo, organization_id)
VALUES (
    '00000000-0000-0000-0000-000000000011',
    'abogado@legalpro.pe',
    'Dr. Juan Garcia Perez',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uHeVP9zARW',
    'ABOGADO',
    'CIVIL',
    TRUE,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (email) DO NOTHING;

-- Usuario fiscal demo (password: Fiscal2024!)
INSERT INTO usuarios (id, email, nombre_completo, password_hash, rol, especialidad, esta_activo, organization_id)
VALUES (
    '00000000-0000-0000-0000-000000000012',
    'fiscal@legalpro.pe',
    'Dr. Maria Lopez Vargas',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uHeVP9zARW',
    'FISCAL',
    'PENAL',
    TRUE,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (email) DO NOTHING;

-- Usuario juez demo (password: Juez2024!)
INSERT INTO usuarios (id, email, nombre_completo, password_hash, rol, especialidad, esta_activo, organization_id)
VALUES (
    '00000000-0000-0000-0000-000000000013',
    'juez@legalpro.pe',
    'Dr. Carlos Mendoza Silva',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uHeVP9zARW',
    'JUEZ',
    'CONSTITUCIONAL',
    TRUE,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (email) DO NOTHING;

-- Membresias
INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'OWNER',  TRUE),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'MEMBER', TRUE),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'MEMBER', TRUE),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'MEMBER', TRUE)
ON CONFLICT (organizacion_id, usuario_id) DO NOTHING;

-- =============================================================================
-- SECCION 5: FUNCION DE DETECCION DE DATOS SENSIBLES (LPDP Peru)
-- =============================================================================
-- Detecta automaticamente si un texto contiene datos sensibles segun
-- Art. 4 inc. 7 LPDP: salud, ideologia politica, origen racial, filiacion sindical,
-- datos biometricos, orientacion sexual, creencias religiosas.
-- =============================================================================
CREATE OR REPLACE FUNCTION detectar_datos_sensibles(p_texto TEXT)
RETURNS JSONB AS $$
DECLARE
    v_resultado JSONB;
    v_patrones_encontrados TEXT[] := ARRAY[]::TEXT[];
    v_severidad TEXT := 'ninguna';
    v_es_sensible BOOLEAN := FALSE;
BEGIN
    IF p_texto IS NULL OR p_texto = '' THEN
        RETURN jsonb_build_object(
            'es_sensible', FALSE,
            'severidad', 'ninguna',
            'patrones', ARRAY[]::TEXT[],
            'recomendacion', 'Sin contenido para analizar'
        );
    END IF;

    -- Patrones de datos sensibles (case-insensitive)
    IF p_texto ~* '(salud|enfermedad|hospital|clinica|diagnostico|tratamiento medico|discapacidad|psicologo|psiquiatria|VIH|SIDA|cancer|diabetes|hipertension)' THEN
        v_patrones_encontrados := array_append(v_patrones_encontrados, 'salud');
    END IF;

    IF p_texto ~* '(ideologia politica|partido politica|militante|simpatizante|comunista|socialista|liberal|conservador|aprista|fujimorista|politica partidaria)' THEN
        v_patrones_encontrados := array_append(v_patrones_encontrados, 'ideologia_politica');
    END IF;

    IF p_texto ~* '(origen racial|etnia|indigena|afroperuano|mestizo|raza|discriminacion racial|comunidad nativa)' THEN
        v_patrones_encontrados := array_append(v_patrones_encontrados, 'origen_racial');
    END IF;

    IF p_texto ~* '(sindicato|sindical|filiacion sindical|grema|gremio|trabajadores sindicalizados|huelga|negociacion colectiva)' THEN
        v_patrones_encontrados := array_append(v_patrones_encontrados, 'filiacion_sindical');
    END IF;

    IF p_texto ~* '(biometrico|huella dactilar|reconocimiento facial|iris|ADN|genetica|marcadores geneticos)' THEN
        v_patrones_encontrados := array_append(v_patrones_encontrados, 'datos_biometricos');
    END IF;

    IF p_texto ~* '(orientacion sexual|homosexual|gay|lesbiana|bisexual|transgenero|LGBT|identidad de genero)' THEN
        v_patrones_encontrados := array_append(v_patrones_encontrados, 'orientacion_sexual');
    END IF;

    IF p_texto ~* '(creencia religiosa|religion|catolico|evangelico|protestante|judio|musulman|ateo|agnostico|iglesia|templo)' THEN
        v_patrones_encontrados := array_append(v_patrones_encontrados, 'creencias_religiosas');
    END IF;

    -- Determinar severidad
    v_es_sensible := array_length(v_patrones_encontrados, 1) > 0;
    
    IF array_length(v_patrones_encontrados, 1) >= 3 THEN
        v_severidad := 'alta';
    ELSIF array_length(v_patrones_encontrados, 1) >= 2 THEN
        v_severidad := 'media';
    ELSIF array_length(v_patrones_encontrados, 1) = 1 THEN
        v_severidad := 'baja';
    END IF;

    v_resultado := jsonb_build_object(
        'es_sensible', v_es_sensible,
        'severidad', v_severidad,
        'patrones', v_patrones_encontrados,
        'recomendacion', CASE 
            WHEN v_severidad = 'alta' THEN 'ALERTA: Se detectaron multiples categorias de datos sensibles. Se requiere consentimiento expreso adicional y medidas de seguridad reforzadas (Art. 4 inc. 7 LPDP).'
            WHEN v_severidad = 'media' THEN 'ATENCION: Se detectaron datos sensibles. Se recomienda verificar consentimiento explicito del titular.'
            WHEN v_severidad = 'baja' THEN 'Precaucion: Posible dato sensible detectado. Revise el contenido antes de procesar.'
            ELSE 'No se detectaron datos sensibles en el contenido analizado.'
        END
    );

    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION detectar_datos_sensibles IS 'Detecta datos sensibles segun LPDP peruana (Art. 4 inc. 7) en texto plano. Retorna JSON con severidad y recomendacion.';

-- -----------------------------------------------------------------------------
-- TABLA: consumo_tokens_ia (Auditoria de IA y control de costos)
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- SECCION 6: ROW LEVEL SECURITY (RLS) — Aislamiento multi-tenant a nivel DB
-- =============================================================================
-- Este esquema NO usa Supabase Auth (auth.uid), por lo que RLS se implementa
-- con variables de sesion personalizadas que la aplicacion establece tras
-- la autenticacion JWT:
--
--   SET SESSION app.current_user_id = 'uuid-del-usuario';
--   SET SESSION app.current_org_id   = 'uuid-de-la-organizacion';
--   SET SESSION app.current_user_rol = 'ABOGADO';
--
-- Las variables se limpian al cerrar la conexion o se reestablecen por peticion.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCION: Obtener el ID del usuario desde la variable de sesion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_rls_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_rls_current_user_id IS 'Retorna el UUID del usuario autenticado desde la variable de sesion app.current_user_id';

-- -----------------------------------------------------------------------------
-- FUNCION: Obtener el ID de la organizacion desde la variable de sesion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_rls_current_org_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_rls_current_org_id IS 'Retorna el UUID de la organizacion activa desde la variable de sesion app.current_org_id';

-- -----------------------------------------------------------------------------
-- FUNCION: Obtener el rol del usuario desde la variable de sesion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_rls_current_user_rol()
RETURNS TEXT AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_rol', TRUE), '');
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_rls_current_user_rol IS 'Retorna el rol del usuario desde la variable de sesion app.current_user_rol';

-- -----------------------------------------------------------------------------
-- RLS: usuarios — cada usuario solo ve su propia fila
-- Los ADMIN pueden ver todos los usuarios de su organizacion
-- -----------------------------------------------------------------------------
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_usuarios_select ON usuarios;
CREATE POLICY p_usuarios_select ON usuarios
    FOR SELECT
    USING (
        -- El usuario ve su propio registro
        id = fn_rls_current_user_id()
        OR
        -- Los ADMIN ven todos los usuarios de su organizacion
        (
            fn_rls_current_user_rol() = 'ADMIN'
            AND organization_id = fn_rls_current_org_id()
        )
    );

DROP POLICY IF EXISTS p_usuarios_insert ON usuarios;
CREATE POLICY p_usuarios_insert ON usuarios
    FOR INSERT
    WITH CHECK (TRUE); -- El registro inicial se hace durante el registro; validado por aplicacion

DROP POLICY IF EXISTS p_usuarios_update ON usuarios;
CREATE POLICY p_usuarios_update ON usuarios
    FOR UPDATE
    USING (id = fn_rls_current_user_id())
    WITH CHECK (id = fn_rls_current_user_id());

DROP POLICY IF EXISTS p_usuarios_delete ON usuarios;
CREATE POLICY p_usuarios_delete ON usuarios
    FOR DELETE
    USING (id = fn_rls_current_user_id());

COMMENT ON POLICY p_usuarios_select ON usuarios IS 'Usuarios ven solo su propio registro; ADMIN ven todos los de su organizacion';
COMMENT ON POLICY p_usuarios_update ON usuarios IS 'Usuarios solo pueden modificar su propio registro';
COMMENT ON POLICY p_usuarios_delete ON usuarios IS 'Usuarios solo pueden eliminar su propio registro';

-- -----------------------------------------------------------------------------
-- RLS: expedientes — solo visibles para usuarios de la misma organizacion
-- -----------------------------------------------------------------------------
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_expedientes_select ON expedientes;
CREATE POLICY p_expedientes_select ON expedientes
    FOR SELECT
    USING (organization_id = fn_rls_current_org_id());

DROP POLICY IF EXISTS p_expedientes_insert ON expedientes;
CREATE POLICY p_expedientes_insert ON expedientes
    FOR INSERT
    WITH CHECK (organization_id = fn_rls_current_org_id());

DROP POLICY IF EXISTS p_expedientes_update ON expedientes;
CREATE POLICY p_expedientes_update ON expedientes
    FOR UPDATE
    USING (organization_id = fn_rls_current_org_id())
    WITH CHECK (organization_id = fn_rls_current_org_id());

DROP POLICY IF EXISTS p_expedientes_delete ON expedientes;
CREATE POLICY p_expedientes_delete ON expedientes
    FOR DELETE
    USING (organization_id = fn_rls_current_org_id());

COMMENT ON POLICY p_expedientes_select ON expedientes IS 'Expedientes visibles solo para usuarios de la misma organizacion';
COMMENT ON POLICY p_expedientes_insert ON expedientes IS 'Solo se pueden crear expedientes en la organizacion propia';
COMMENT ON POLICY p_expedientes_update ON expedientes IS 'Solo se pueden modificar expedientes de la organizacion propia';
COMMENT ON POLICY p_expedientes_delete ON expedientes IS 'Solo se pueden eliminar expedientes de la organizacion propia';

-- -----------------------------------------------------------------------------
-- RLS: documentos — solo visibles para usuarios de la misma organizacion
-- -----------------------------------------------------------------------------
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_documentos_select ON documentos;
CREATE POLICY p_documentos_select ON documentos
    FOR SELECT
    USING (organization_id = fn_rls_current_org_id());

DROP POLICY IF EXISTS p_documentos_insert ON documentos;
CREATE POLICY p_documentos_insert ON documentos
    FOR INSERT
    WITH CHECK (organization_id = fn_rls_current_org_id());

DROP POLICY IF EXISTS p_documentos_update ON documentos;
CREATE POLICY p_documentos_update ON documentos
    FOR UPDATE
    USING (organization_id = fn_rls_current_org_id())
    WITH CHECK (organization_id = fn_rls_current_org_id());

DROP POLICY IF EXISTS p_documentos_delete ON documentos;
CREATE POLICY p_documentos_delete ON documentos
    FOR DELETE
    USING (organization_id = fn_rls_current_org_id());

COMMENT ON POLICY p_documentos_select ON documentos IS 'Documentos visibles solo para usuarios de la misma organizacion';
COMMENT ON POLICY p_documentos_insert ON documentos IS 'Solo se pueden crear documentos en la organizacion propia';
COMMENT ON POLICY p_documentos_update ON documentos IS 'Solo se pueden modificar documentos de la organizacion propia';
COMMENT ON POLICY p_documentos_delete ON documentos IS 'Solo se pueden eliminar documentos de la organizacion propia';

-- -----------------------------------------------------------------------------
-- NOTA: Las tablas restantes (simulaciones, mensajes_chat, notificaciones_sinoe,
-- evidencia_digital, audit_log, consumo_tokens_ia, etc.) heredan el aislamiento
-- multi-tenant via organization_id a nivel de aplicacion (filtro WHERE).
-- RLS se activara progresivamente en estas tablas segun auditoria de performance.
-- -----------------------------------------------------------------------------