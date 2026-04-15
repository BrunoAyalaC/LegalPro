-- =============================================================================
-- LegalPro — Esquema unificado para Railway PostgreSQL
-- =============================================================================
-- Combina: EF Core .NET tables + módulos legales (Node backend)
-- SIN dependencias de Supabase Auth (auth.uid, auth.users, RLS)
-- Railway provee DATABASE_URL con acceso directo a este esquema
-- Versión: 1.0.0 | Fecha: 2026-04-10
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN TRIGGER: updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECCIÓN 1: TABLAS CORE (EF Core .NET Backend)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: organizaciones (Tenant root)
-- ─────────────────────────────────────────────────────────────────────────────
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
    config            JSONB       NOT NULL DEFAULT '{}',
    metadata          JSONB       NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE organizaciones IS 'Tenant root: cada organización es un espacio aislado (estudio jurídico, fiscalía, juzgado)';

CREATE TRIGGER trg_organizaciones_updated_at
    BEFORE UPDATE ON organizaciones
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_organizaciones_slug ON organizaciones(slug);
CREATE INDEX IF NOT EXISTS idx_organizaciones_activo ON organizaciones(activo);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: usuarios (Auth propio — reemplaza Supabase Auth)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT        NOT NULL UNIQUE,
    nombre_completo   TEXT        NOT NULL,
    password_hash     TEXT        NOT NULL,
    rol               TEXT        NOT NULL DEFAULT 'ABOGADO'
                                  CHECK (rol IN ('ABOGADO', 'JUEZ', 'FISCAL', 'CONTADOR', 'ADMIN')),
    especialidad      TEXT        DEFAULT 'GENERAL',
    esta_activo       BOOLEAN     NOT NULL DEFAULT TRUE,
    organization_id   UUID        REFERENCES organizaciones(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE  usuarios              IS 'Usuarios del sistema con auth propio (JWT + bcrypt)';
COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt de la contraseña (cost=12)';
COMMENT ON COLUMN usuarios.rol          IS 'Rol principal: ABOGADO | JUEZ | FISCAL | CONTADOR | ADMIN';

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_org_rol ON usuarios(organization_id, rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_esta_activo ON usuarios(esta_activo);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: miembros_organizacion (Multi-tenancy linking table)
-- Usada por EF Core .NET backend — nombre canónico del proyecto
-- ─────────────────────────────────────────────────────────────────────────────
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

COMMENT ON TABLE miembros_organizacion IS 'Membresía de usuarios en organizaciones (multi-tenant)';
COMMENT ON COLUMN miembros_organizacion.rol IS 'OWNER | ADMIN | MEMBER | VIEWER';

CREATE INDEX IF NOT EXISTS ix_miembros_organizacion_usuario_id ON miembros_organizacion(usuario_id);
CREATE INDEX IF NOT EXISTS ix_miembros_organizacion_organizacion_id_usuario_id ON miembros_organizacion(organizacion_id, usuario_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: refresh_tokens
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: expedientes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expedientes (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID        REFERENCES usuarios(id) ON DELETE RESTRICT,
    organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    numero            TEXT        NOT NULL UNIQUE,
    titulo            TEXT        NOT NULL,
    tipo              TEXT        DEFAULT 'civil'
                                  CHECK (tipo IN ('penal', 'civil', 'laboral', 'constitucional', 'familia', 'administrativo')),
    estado            TEXT        DEFAULT 'activo'
                                  CHECK (estado IN ('activo', 'archivado', 'cerrado', 'suspendido')),
    juzgado           TEXT,
    partes            JSONB       DEFAULT '{}',
    hechos            TEXT,
    teoria_caso       TEXT,
    materia           TEXT,
    tipo_proceso      TEXT,
    numero_expediente TEXT,
    es_urgente        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE expedientes IS 'Expedientes judiciales — núcleo del sistema legal';

CREATE TRIGGER trg_expedientes_updated_at
    BEFORE UPDATE ON expedientes
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_expedientes_org_estado ON expedientes(organization_id, estado);
CREATE INDEX IF NOT EXISTS idx_expedientes_org_created ON expedientes(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expedientes_usuario_id ON expedientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_numero ON expedientes(numero);
CREATE INDEX IF NOT EXISTS idx_expedientes_materia ON expedientes(materia);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: simulaciones (Simulador de juicios IA)
-- ─────────────────────────────────────────────────────────────────────────────
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

CREATE TRIGGER trg_simulaciones_updated_at
    BEFORE UPDATE ON simulaciones
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_simulaciones_org ON simulaciones(organization_id);
CREATE INDEX IF NOT EXISTS idx_simulaciones_usuario_id ON simulaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_simulaciones_estado ON simulaciones(estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: eventos_simulacion
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: mensajes_chat (Chat IA contextual)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: base_legal_vectorial (Jurisprudencia para búsqueda semántica)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: invitaciones_organizacion
-- ─────────────────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON invitaciones_organizacion(token) WHERE esta_aceptada = FALSE;
CREATE INDEX IF NOT EXISTS idx_invitaciones_org ON invitaciones_organizacion(organization_id);

-- =============================================================================
-- SECCIÓN 2: MÓDULOS LEGALES (Node Backend)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: documentos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id     UUID        REFERENCES expedientes(id) ON DELETE CASCADE,
    usuario_id        UUID        REFERENCES usuarios(id),
    organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    nombre            TEXT        NOT NULL,
    tipo_documento    TEXT        NOT NULL,
    descripcion       TEXT,
    archivo_url       TEXT,
    archivo_nombre    TEXT,
    archivo_tipo      TEXT,
    archivo_tamano    BIGINT,
    hash_sha256       TEXT,
    etiquetas         TEXT[]      DEFAULT '{}',
    relacionado_con   UUID        REFERENCES documentos(id),
    fecha_documento   DATE,
    creado_en         TIMESTAMPTZ DEFAULT now(),
    actualizado_en    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_expediente_id ON documentos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_organization_id ON documentos(organization_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_etiquetas ON documentos USING gin(etiquetas);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: notificaciones_sinoe
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: evidencia_digital (Bóveda de evidencia)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: evidencia_accesos (Cadena de custodia)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidencia_accesos (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    evidencia_id      UUID        REFERENCES evidencia_digital(id) ON DELETE CASCADE,
    usuario_id        UUID        REFERENCES usuarios(id),
    accion            TEXT        NOT NULL,
    ip_address        INET,
    user_agent        TEXT,
    creado_en         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidencia_accesos_evidencia ON evidencia_accesos(evidencia_id);
CREATE INDEX IF NOT EXISTS idx_evidencia_accesos_usuario ON evidencia_accesos(usuario_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: predicciones_judiciales
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predicciones_judiciales (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id                  UUID        REFERENCES usuarios(id),
    organization_id             UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    expediente_id               UUID        REFERENCES expedientes(id),
    tipo_proceso                TEXT        NOT NULL,
    materia                     TEXT        NOT NULL,
    probabilidad_exito          NUMERIC(5,2),
    nivel_confianza             TEXT,
    analisis_ia                 JSONB       NOT NULL DEFAULT '{}',
    factores_favorables         JSONB,
    factores_desfavorables      JSONB,
    riesgos                     JSONB,
    recomendaciones             JSONB,
    tiempo_estimado_meses       INTEGER,
    creado_en                   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predicciones_expediente ON predicciones_judiciales(expediente_id);
CREATE INDEX IF NOT EXISTS idx_predicciones_organization_id ON predicciones_judiciales(organization_id);
CREATE INDEX IF NOT EXISTS idx_predicciones_fecha ON predicciones_judiciales(creado_en DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: estrategias_interrogatorio (NCPP)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estrategias_interrogatorio (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id              UUID        REFERENCES usuarios(id),
    organization_id         UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    expediente_id           UUID        REFERENCES expedientes(id),
    teoria_caso             TEXT        NOT NULL,
    interrogatorio_directo  JSONB       NOT NULL DEFAULT '[]',
    contrainterrogatorio    JSONB       NOT NULL DEFAULT '[]',
    objetos_impugnacion     JSONB,
    repreguntas             JSONB,
    creado_en               TIMESTAMPTZ DEFAULT now(),
    actualizado_en          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estrategias_expediente ON estrategias_interrogatorio(expediente_id);
CREATE INDEX IF NOT EXISTS idx_estrategias_organization_id ON estrategias_interrogatorio(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: suscripciones (Billing por organización)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suscripciones (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    plan              TEXT        NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    estado            TEXT        NOT NULL DEFAULT 'activa'
                                  CHECK (estado IN ('activa', 'cancelada', 'vencida', 'trial')),
    fecha_inicio      DATE        NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    precio_mensual    NUMERIC(10,2) DEFAULT 0,
    moneda            TEXT        NOT NULL DEFAULT 'PEN',
    proveedor_pago    TEXT,
    referencia_pago   TEXT,
    metadata          JSONB       NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ
);

CREATE TRIGGER trg_suscripciones_updated_at
    BEFORE UPDATE ON suscripciones
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_suscripciones_org_estado ON suscripciones(organization_id, estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: audit_log (Trazabilidad inmutable multi-tenant)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- =============================================================================
-- SECCIÓN 3: FUNCIÓN DE VALIDACIÓN DE LÍMITES DE PLAN
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
        RETURN jsonb_build_object('puede', FALSE, 'motivo', 'Organización no encontrada o inactiva');
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
                       ELSE format('Límite de %s alcanzado (%s/%s) para plan %s', p_recurso, v_actual, v_limite, v_org.plan)
                   END
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- SECCIÓN 4: DATOS SEMILLA (Demo para arranque en Railway)
-- =============================================================================

-- Organización demo
INSERT INTO organizaciones (id, nombre, slug, plan, max_usuarios, max_expedientes, activo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Estudio Jurídico Demo',
    'estudio-demo',
    'pro',
    15,
    200,
    TRUE
) ON CONFLICT (slug) DO NOTHING;

-- Usuario admin demo (password: Admin2024! → bcrypt cost=12)
-- Hash pre-generado: para cambiar, generar con: node -e "require('bcryptjs').hash('Admin2024!',12).then(console.log)"
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
    'Dr. Juan García Pérez',
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
    'Dr. María López Vargas',
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

-- Membresías
INSERT INTO miembros_organizacion (organizacion_id, usuario_id, rol, activo)
VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'OWNER',  TRUE),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'MEMBER', TRUE),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'MEMBER', TRUE),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'MEMBER', TRUE)
ON CONFLICT (organizacion_id, usuario_id) DO NOTHING;

-- Suscripción demo
INSERT INTO suscripciones (organization_id, plan, estado, precio_mensual)
VALUES ('00000000-0000-0000-0000-000000000001', 'pro', 'activa', 99.00)
ON CONFLICT DO NOTHING;
