# Schema de Supabase / PostgreSQL — Catálogo canónico

> Reemplaza la duplicación que existía en 3 archivos: `database.agent.md`, `dominio-legal.agent.md`, `migrar-base-de-datos/SKILL.md`.

## Convenciones

- **Nombre tabla**: `snake_case`, plural (`users`, `expedientes`, `documentos`)
- **Columnas**: `snake_case`, `NOT NULL` cuando aplique
- **Primary Key**: `id UUID DEFAULT gen_random_uuid()` o `id BIGSERIAL`
- **Timestamps**: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ NULL`
- **Multi-tenant**: `organization_id UUID NOT NULL` + RLS + index
- **Soft-delete**: SIEMPRE (excepto `audit_log` y `outbox_messages`)
- **Audit log**: trigger INSERT/UPDATE/DELETE -> `audit_log`

## Tablas

### 1. `usuarios`

```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL, -- LPDP: para búsqueda sin descifrar
  password_hash TEXT NOT NULL, -- bcrypt
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  dni TEXT, -- LPDP: cifrado con pgcrypto
  telefono TEXT,
  rol_usuario TEXT NOT NULL CHECK (rol_usuario IN ('ABOGADO', 'FISCAL', 'JUEZ', 'CONTADOR', 'ADMIN')),
  especialidad TEXT,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  terminos_aceptados_at TIMESTAMPTZ,
  privacidad_aceptados_at TIMESTAMPTZ,
  marketing_aceptado BOOLEAN DEFAULT false,
  acepto_transferencia_internacional BOOLEAN DEFAULT false, -- LPDP Art. 21
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_usuarios_org ON usuarios(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_usuarios_email ON usuarios(email) WHERE deleted_at IS NULL;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY usuarios_isolation ON usuarios
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### 2. `organizaciones`

```sql
CREATE TABLE organizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  ruc TEXT,
  plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE')),
  max_expedientes INT NOT NULL DEFAULT 5,
  max_usuarios INT NOT NULL DEFAULT 1,
  max_consultas_ia_mes INT NOT NULL DEFAULT 50,
  consultas_ia_usadas_mes INT NOT NULL DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES usuarios(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_organizaciones_slug ON organizaciones(slug) WHERE deleted_at IS NULL;

ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizaciones_owner ON organizaciones
  USING (owner_id = current_setting('app.user_id')::UUID);
```

### 3. `miembros_organizacion`

```sql
CREATE TABLE miembros_organizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  rol_miembro TEXT NOT NULL CHECK (rol_miembro IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  invited_by UUID REFERENCES usuarios(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(organization_id, usuario_id)
);

CREATE INDEX idx_miembros_org_user ON miembros_organizacion(organization_id, usuario_id) WHERE deleted_at IS NULL;

ALTER TABLE miembros_organizacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY miembros_isolation ON miembros_organizacion
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### 4. `expedientes`

```sql
CREATE TABLE expedientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  numero_expediente TEXT NOT NULL, -- formato DDDDD-YYYY
  materia TEXT NOT NULL CHECK (materia IN ('penal', 'civil', 'laboral', 'constitucional', 'familia', 'administrativo', 'tributario', 'comercial')),
  tipo_proceso TEXT, -- CPC, NCPP, LPCL, etc.
  instancia TEXT NOT NULL CHECK (instancia IN ('JUZGADO', 'SALA', 'CASACION', 'TC', 'ARBITRAJE')),
  partes JSONB NOT NULL, -- {demandante, demandado, tercero, fiscal, juez}
  hechos TEXT,
  pretensiones JSONB,
  estado TEXT NOT NULL DEFAULT 'EN_TRAMITE' CHECK (estado IN ('EN_TRAMITE', 'CONCLUIDO', 'ARCHIVADO', 'SUSPENDIDO')),
  fecha_inicio DATE NOT NULL,
  fecha_conclusion DATE,
  abogado_responsable UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_expedientes_org ON expedientes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_numero ON expedientes(numero_expediente) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_materia ON expedientes(materia) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_estado ON expedientes(estado) WHERE deleted_at IS NULL;

ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY expedientes_isolation ON expedientes
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### 5. `documentos`

```sql
CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  expediente_id UUID REFERENCES expedientes(id),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('demanda', 'contestacion', 'apelacion', 'casacion', 'contrato', 'sentencia', 'resolucion', 'escrito', 'prueba', 'otro')),
  mime_type TEXT NOT NULL,
  tamano_bytes BIGINT NOT NULL,
  hash_sha256 TEXT NOT NULL UNIQUE,
  storage_url TEXT NOT NULL, -- Supabase Storage URL
  subido_por UUID NOT NULL REFERENCES usuarios(id),
  texto_ocr TEXT, -- LPDP: puede contener PII
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'done', 'failed')),
  es_inmutable BOOLEAN DEFAULT true, -- Ley 27269
  firma_digital_id UUID, -- PKCS#7
  timestamp_autoridad_tiempo TIMESTAMPTZ, -- TSA
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_documentos_org ON documentos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documentos_expediente ON documentos(expediente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documentos_hash ON documentos(hash_sha256);

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY documentos_isolation ON documentos
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### 6. `evidencia` (Bóveda)

```sql
CREATE TABLE evidencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  hash_sha256 TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  cadena_custodia JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by UUID NOT NULL REFERENCES usuarios(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  es_inmutable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE evidencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidencia_isolation ON evidencia
  USING (organization_id = current_setting('app.organization_id')::UUID);

-- Trigger para inmutabilidad
CREATE OR REPLACE FUNCTION trg_evidencia_inmutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Evidencia es inmutable, no se permite UPDATE/DELETE';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_evidencia_inmutable_update
  BEFORE UPDATE ON evidencia
  FOR EACH ROW EXECUTE FUNCTION trg_evidencia_inmutable();
```

### 7. `simulaciones`

```sql
CREATE TABLE simulaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  user_id UUID NOT NULL REFERENCES usuarios(id),
  expediente_id UUID REFERENCES expedientes(id),
  rol_usuario TEXT NOT NULL,
  rol_ia TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'EN_CURSO' CHECK (estado IN ('EN_CURSO', 'FINALIZADA', 'ABANDONADA')),
  score_final INT, -- 1-10
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE eventos_simulacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacion_id UUID NOT NULL REFERENCES simulaciones(id),
  turno INT NOT NULL,
  emisor TEXT NOT NULL CHECK (emisor IN ('USUARIO', 'IA')),
  contenido TEXT NOT NULL,
  score INT, -- 1-10 si es USUARIO
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eventos_sim ON eventos_simulacion(simulacion_id);

ALTER TABLE simulaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY simulaciones_isolation ON simulaciones
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### 8. `mensajes_chat`

```sql
CREATE TABLE mensajes_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  user_id UUID NOT NULL REFERENCES usuarios(id),
  expediente_id UUID REFERENCES expedientes(id),
  rol TEXT NOT NULL, -- 'user' | 'assistant'
  contenido TEXT NOT NULL,
  function_calls JSONB, -- OpenCode FC (DeepSeek V4 Flash)
  tokens_input INT,
  tokens_output INT,
  costo_usd NUMERIC(10, 6),
  modelo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_mensajes_chat_user ON mensajes_chat(user_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE mensajes_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY mensajes_chat_isolation ON mensajes_chat
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### 9. `consumo_tokens_ia`

```sql
CREATE TABLE consumo_tokens_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  user_id UUID NOT NULL REFERENCES usuarios(id),
  herramienta TEXT NOT NULL, -- 'analizar_expediente', 'redactar_escrito', etc.
  modelo TEXT NOT NULL,
  tokens_input INT NOT NULL,
  tokens_output INT NOT NULL,
  costo_usd NUMERIC(10, 6) NOT NULL,
  function_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consumo_org_fecha ON consumo_tokens_ia(organization_id, created_at DESC);

ALTER TABLE consumo_tokens_ia ENABLE ROW LEVEL SECURITY;
```

### 10. `transacciones_creditos`

```sql
CREATE TABLE transacciones_creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('DEBITO', 'CREDITO', 'BONIFICACION', 'EXPIRACION')),
  monto INT NOT NULL, -- positivo o negativo
  descripcion TEXT,
  idempotency_key TEXT UNIQUE, -- previene doble descuento
  referencia_consumo_id UUID REFERENCES consumo_tokens_ia(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 11. `consentimientos` (LPDP)

```sql
CREATE TABLE consentimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES usuarios(id),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  finalidades JSONB NOT NULL, -- {marketing: false, ia_analisis: true, transferencia_internacional: true, ...}
  terminos_aceptados BOOLEAN NOT NULL DEFAULT false,
  privacidad_aceptados BOOLEAN NOT NULL DEFAULT false,
  ip_consentimiento INET,
  user_agent TEXT,
  version_terminos TEXT NOT NULL, -- ej. "v1.0.0"
  version_privacidad TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE INDEX idx_consentimientos_user ON consentimientos(user_id, created_at DESC);
```

### 12. `audit_log` (LPDP Art. 23 + ISO 27001)

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID,
  event_name TEXT NOT NULL, -- AUTH_LOGIN_SUCCESS, IA_REQUEST, etc. (ver catalogs/audit-events.json)
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  table_name TEXT,
  record_key TEXT,
  correlation_id UUID,
  ip_address INET,
  user_agent TEXT,
  payload_masked JSONB, -- NUNCA PII en claro
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_fecha ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_event ON audit_log(event_name, created_at DESC);
```

### 13. `outbox_messages` (Outbox Pattern)

```sql
CREATE TABLE outbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- Fully qualified class name
  payload JSONB NOT NULL,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 5,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT
);

CREATE INDEX idx_outbox_pending ON outbox_messages(created_at) WHERE processed_at IS NULL;
```

### 14. `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES usuarios(id),
  token_hash TEXT NOT NULL UNIQUE, -- bcrypt del token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  revoked_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(token_hash) WHERE NOT revoked;
```

### 15. `invitaciones_organizacion`

```sql
CREATE TABLE invitaciones_organizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  email_invitado TEXT NOT NULL,
  rol_miembro TEXT NOT NULL,
  token_invitacion TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES usuarios(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 16. `base_legal_vectorial` (Embeddings)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE base_legal_vectorial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('CONSTITUCION', 'CODIGO', 'LEY', 'CASACION', 'ACUERDO_PLENARIO', 'DOCTRINA')),
  norma_id TEXT, -- FK lógica a catalogs/codigos-leyes.json
  articulo TEXT,
  contenido TEXT NOT NULL,
  embedding vector(768), -- opencode embeddings (DeepSeek V4 Flash)
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_base_legal_vector ON base_legal_vectorial USING ivfflat (embedding vector_cosine_ops);
```

### 17. `predicciones_judiciales`

```sql
CREATE TABLE predicciones_judiciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  resultado TEXT NOT NULL, -- 'FAVORABLE' | 'DESFAVORABLE' | 'INCIERTO'
  nivel_confianza TEXT NOT NULL CHECK (nivel_confianza IN ('BAJO', 'MEDIO', 'ALTO')),
  probabilidades JSONB, -- {favorable: 0.6, desfavorable: 0.3, incierto: 0.1}
  sentencias_base UUID[], -- array de IDs de base_legal_vectorial
  modelo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE predicciones_judiciales ENABLE ROW LEVEL SECURITY;
```

## RLS Helper Function

```sql
-- Función helper para configurar el tenant actual
CREATE OR REPLACE FUNCTION set_current_tenant(p_org_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_org_id::text, true);
  PERFORM set_config('app.user_id', p_user_id::text, true);
END;
$$ LANGUAGE plpgsql;
```

## Auditoría

Cada nueva tabla DEBE:
1. Tener `organization_id UUID NOT NULL`
2. Tener `created_at`, `updated_at`, `deleted_at`
3. Tener RLS habilitado y policy de aislamiento
4. Tener índices en FKs
5. Tener trigger de `audit_log` (excepto `audit_log` y `outbox_messages`)
