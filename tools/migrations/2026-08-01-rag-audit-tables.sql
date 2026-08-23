-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN RAG AUDIT + METRICS + CACHE — 1 de agosto de 2026
-- ══════════════════════════════════════════════════════════════════════════════
-- FIX RAG-MIG: Tablas faltantes para audit, métricas y cache del sistema RAG.
--
-- ⚠️  CRÍTICO: Antes de ejecutar, hacer backup completo de la BD
--     Railway: `railway pg backup create` o `pg_dump --format=custom --no-owner`
--
-- CONVENCIONES APLICADAS (alineadas con catalogs/supabase-schema.md, init.sql
-- y tools/migrations/2026-08-01-multitenant-hardening.sql):
--   • snake_case en nombres de tabla/columna
--   • organization_id UUID NOT NULL en toda tabla tenant
--   • RLS con `current_setting('app.current_org_id')::UUID` (mismo patrón del proyecto)
--   • ENABLE + FORCE ROW LEVEL SECURITY (defensa contra owner con BYPASSRLS)
--   • created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() en TODAS las tablas
--   • updated_at + trigger fn_set_updated_at() SOLO en entidades mutables
--     (rag_corpus_snapshot). Las tablas append-only (rag_audit_log,
--     rag_cache_stats, rag_provider_costs) NO tienen updated_at ni deleted_at
--     para preservar inmutabilidad y evitar la regla "tabla sin deleted_at"
--     (los logs/audits son la excepción documentada en supabase-schema.md).
--   • Índices parciales WHERE IS NOT NULL / WHERE TRUE para optimizar lecturas
--     en columnas opcionales (correlation_id, alerta_spike).
--   • CHECK constraints en ENUMs lógicos (operacion, provider, cache_layer) —
--     defensa contra typos en inserciones desde backend.
--   • rag_audit_log es INSERT-only RLS (mismo patrón que audit_log en init.sql)
--     para preservar trazabilidad LPDP Art. 23 + ISO 27001 A.12.4.
--   • rag_provider_costs permite organization_id NULL para eventos de sistema
--     (ej. jobs cron globales); la policy permite tanto filas tenant como
--     filas system-wide visibles para todos los tenants.
--   • rag_corpus_snapshot y rag_cache_stats son tablas GLOBALES (sin tenant)
--     porque el corpus jurídico y el cache Redis son recursos compartidos del
--     sistema; NO requieren RLS.
--   • No se crea trigger a `audit_log` sobre estas tablas (son tablas de
--     auditoría → la recursión está prohibida por diseño).
--   • GRANT explícito a los roles de aplicación legalpro_node / legalpro_dotnet
--     (definidos en 2026-08-01-multitenant-hardening.sql) y al legacy
--     legalpro_app (definido en 2026-enable-rls.sql) para que la app pueda
--     usar estas tablas inmediatamente.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. TABLA: rag_audit_log
-- ══════════════════════════════════════════════════════════════════════════════
-- Registra cada consulta RAG con métricas de retrieval, calidad, performance
-- y costos. Es el insumo principal para:
--   • dashboards de uso y latencia (v_rag_metrics_7d)
--   • alertas de baja confianza (v_rag_top_low_confidence)
--   • análisis de costos por proveedor (cruzando con rag_provider_costs)
--   • auditoría LPDP Art. 23 (la consulta NO se guarda en claro, solo el hash)
--
-- NOTA: append-only. NO tiene updated_at ni deleted_at por diseño (es log).
CREATE TABLE IF NOT EXISTS rag_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Identificación ────────────────────────────────────────────────────────
  user_id UUID REFERENCES usuarios(id),
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  correlation_id TEXT,

  -- ── Consulta (hasheada por privacidad) ────────────────────────────────────
  consulta_hash TEXT NOT NULL,                -- SHA-256 de la consulta (no PII en claro)
  materia TEXT NOT NULL,

  -- ── Métricas de retrieval ─────────────────────────────────────────────────
  chunks_usados INT NOT NULL DEFAULT 0 CHECK (chunks_usados >= 0),
  similitud_promedio DECIMAL(4,3) NOT NULL DEFAULT 0.000
    CHECK (similitud_promedio >= 0 AND similitud_promedio <= 1),
  citaciones_usadas INT NOT NULL DEFAULT 0 CHECK (citaciones_usadas >= 0),
  citaciones_verificadas BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Calidad ───────────────────────────────────────────────────────────────
  alucinaciones_detectadas INT NOT NULL DEFAULT 0 CHECK (alucinaciones_detectadas >= 0),
  contexto_relevancia DECIMAL(4,3)
    CHECK (contexto_relevancia IS NULL OR (contexto_relevancia >= 0 AND contexto_relevancia <= 1)),
  respuesta_relevancia DECIMAL(4,3)
    CHECK (respuesta_relevancia IS NULL OR (respuesta_relevancia >= 0 AND respuesta_relevancia <= 1)),

  -- ── Performance ──────────────────────────────────────────────────────────
  latency_ms INT CHECK (latency_ms IS NULL OR latency_ms >= 0),
  retrieval_latency_ms INT CHECK (retrieval_latency_ms IS NULL OR retrieval_latency_ms >= 0),
  llm_latency_ms INT CHECK (llm_latency_ms IS NULL OR llm_latency_ms >= 0),

  -- ── Costos ───────────────────────────────────────────────────────────────
  costo_usd DECIMAL(10,6) NOT NULL DEFAULT 0.000000 CHECK (costo_usd >= 0),
  embedding_tokens INT NOT NULL DEFAULT 0 CHECK (embedding_tokens >= 0),
  llm_input_tokens INT NOT NULL DEFAULT 0 CHECK (llm_input_tokens >= 0),
  llm_output_tokens INT NOT NULL DEFAULT 0 CHECK (llm_output_tokens >= 0),

  -- ── Metadata ──────────────────────────────────────────────────────────────
  proveedor_embeddings TEXT
    CHECK (proveedor_embeddings IS NULL OR proveedor_embeddings IN ('openai', 'gemini', 'minimax', 'voyage', 'cohere')),
  proveedor_llm TEXT
    CHECK (proveedor_llm IS NULL OR proveedor_llm IN ('openai', 'gemini', 'minimax', 'anthropic')),
  modelo TEXT,
  rag_version TEXT NOT NULL DEFAULT 'v1.0',
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- ── Cache info ───────────────────────────────────────────────────────────
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  cache_layer TEXT NOT NULL DEFAULT 'none'
    CHECK (cache_layer IN ('redis', 'memory', 'none'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rag_audit_org_date
  ON rag_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_audit_user_date
  ON rag_audit_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_audit_materia
  ON rag_audit_log(materia, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_audit_correlation
  ON rag_audit_log(correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_audit_created
  ON rag_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_audit_cache_hit
  ON rag_audit_log(organization_id, created_at DESC)
  WHERE cache_hit = TRUE;

-- RLS: patrón INSERT-only (mismo que audit_log en init.sql) — defensa LPDP.
ALTER TABLE rag_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_audit_log_select ON rag_audit_log;
CREATE POLICY rag_audit_log_select ON rag_audit_log
  FOR SELECT
  USING (organization_id = current_setting('app.current_org_id', TRUE)::UUID);

DROP POLICY IF EXISTS rag_audit_log_insert ON rag_audit_log;
CREATE POLICY rag_audit_log_insert ON rag_audit_log
  FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_org_id', TRUE)::UUID);

-- Sin policies UPDATE/DELETE → default deny (preserva inmutabilidad del log).

COMMENT ON TABLE rag_audit_log IS
  'Audit log del sistema RAG con métricas de retrieval, calidad, performance y costos. INSERT-only por RLS. Retención: 90 días (purga via fn_cleanup_old_rag_audit).';
COMMENT ON COLUMN rag_audit_log.consulta_hash IS
  'SHA-256 de la consulta original. NO se guarda el texto en claro para evitar PII (LPDP Art. 4).';
COMMENT ON COLUMN rag_audit_log.organization_id IS
  'Tenant al que pertenece la consulta. RLS usa app.current_org_id para aislamiento.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. TABLA: rag_corpus_snapshot
-- ══════════════════════════════════════════════════════════════════════════════
-- Historial de versiones del corpus jurídico. Permite rollback si un nuevo
-- índice vectorial degrada la calidad. Tabla GLOBAL (sin tenant) porque el
-- corpus es un recurso compartido del sistema, no datos tenant.
--
-- Por ser tabla global: sin organization_id, sin RLS, con updated_at.
CREATE TABLE IF NOT EXISTS rag_corpus_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  snapshot_name TEXT NOT NULL UNIQUE,        -- UNIQUE permite ON CONFLICT en seed
  fuente TEXT NOT NULL,                      -- 'SPIJ' | 'TC' | 'INDECOPI' | 'manual' | 'multi'
  total_documentos INT NOT NULL CHECK (total_documentos >= 0),
  total_chunks INT NOT NULL CHECK (total_chunks >= 0),
  embedding_model TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT                            -- usuario que creó el snapshot (auditoría)
);

CREATE INDEX IF NOT EXISTS idx_rag_corpus_created
  ON rag_corpus_snapshot(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_corpus_fuente
  ON rag_corpus_snapshot(fuente, created_at DESC);

-- Trigger de updated_at (reutiliza fn_set_updated_at de init.sql si existe)
DROP TRIGGER IF EXISTS trg_rag_corpus_snapshot_updated_at ON rag_corpus_snapshot;
CREATE TRIGGER trg_rag_corpus_snapshot_updated_at
  BEFORE UPDATE ON rag_corpus_snapshot
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE rag_corpus_snapshot IS
  'Historial de versiones del corpus RAG jurídico (SPIJ, TC, INDECOPI). Permite rollback cuando un embedding degrada la calidad. Tabla global del sistema (no tenant).';
COMMENT ON COLUMN rag_corpus_snapshot.checksum_sha256 IS
  'Hash SHA-256 del snapshot completo para detectar corrupción o cambios no autorizados.';
COMMENT ON COLUMN rag_corpus_snapshot.snapshot_name IS
  'Identificador legible y único del snapshot (ej. ''alfa-monetizable-2026-08-01'').';


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. TABLA: rag_cache_stats
-- ══════════════════════════════════════════════════════════════════════════════
-- Métricas agregadas del cache Redis, escritas por un cron diario.
-- Tabla GLOBAL (sin tenant, sin RLS) — el cache es compartido.
-- Una fila por día (CONSTRAINT UNIQUE sobre DATE(created_at)).
CREATE TABLE IF NOT EXISTS rag_cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  total_keys INT CHECK (total_keys IS NULL OR total_keys >= 0),
  ttl_seconds INT CHECK (ttl_seconds IS NULL OR ttl_seconds >= 0),
  redis_connected BOOLEAN NOT NULL DEFAULT FALSE,
  hit_rate_pct DECIMAL(5,2) CHECK (hit_rate_pct IS NULL OR (hit_rate_pct >= 0 AND hit_rate_pct <= 100)),
  miss_rate_pct DECIMAL(5,2) CHECK (miss_rate_pct IS NULL OR (miss_rate_pct >= 0 AND miss_rate_pct <= 100)),
  memory_used_mb DECIMAL(10,2) CHECK (memory_used_mb IS NULL OR memory_used_mb >= 0),

  -- Garantiza una sola fila por día (para que el cron use ON CONFLICT DO UPDATE)
  CONSTRAINT rag_cache_stats_unique_date UNIQUE (DATE(created_at))
);

CREATE INDEX IF NOT EXISTS idx_rag_cache_stats_date
  ON rag_cache_stats(DATE(created_at) DESC);

COMMENT ON TABLE rag_cache_stats IS
  'Métricas diarias del cache Redis del sistema RAG. Una fila por día (constraint UNIQUE). Escribe un cron diario. Tabla global del sistema.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. TABLA: rag_provider_costs
-- ══════════════════════════════════════════════════════════════════════════════
-- Tracking detallado de costos por proveedor/modelo/operación. Se cruza con
-- rag_audit_log (métricas de uso) y con alertas (alerta_spike) para detectar
-- abuso o anomalías de facturación.
--
-- Tabla TENANT con organization_id NULLABLE:
--   • NULL   = evento de sistema (job cron, recalentamiento de cache) → visible
--              para todos los tenants (no facturable a un cliente específico)
--   • SET    = costo atribuible a un tenant específico → RLS lo aísla
CREATE TABLE IF NOT EXISTS rag_provider_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  organization_id UUID REFERENCES organizaciones(id),
  provider TEXT NOT NULL
    CHECK (provider IN ('openai', 'gemini', 'minimax', 'anthropic')),
  model TEXT NOT NULL,

  operation TEXT NOT NULL
    CHECK (operation IN ('embedding', 'chat', 'search', 'rerank', 'moderation')),
  tokens_input INT NOT NULL DEFAULT 0 CHECK (tokens_input >= 0),
  tokens_output INT NOT NULL DEFAULT 0 CHECK (tokens_output >= 0),
  costo_usd DECIMAL(10,6) NOT NULL CHECK (costo_usd >= 0),

  -- Para alertas (configurable por monitor-costos-ia)
  alerta_spike BOOLEAN NOT NULL DEFAULT FALSE,
  threshold_excedido DECIMAL(10,6) CHECK (threshold_excedido IS NULL OR threshold_excedido >= 0),

  -- Trazabilidad cruzada con rag_audit_log
  rag_audit_id UUID REFERENCES rag_audit_log(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_provider_costs_org
  ON rag_provider_costs(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_provider_costs_provider
  ON rag_provider_costs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_provider_costs_model
  ON rag_provider_costs(model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_provider_costs_alerta
  ON rag_provider_costs(alerta_spike, created_at DESC)
  WHERE alerta_spike = TRUE;
CREATE INDEX IF NOT EXISTS idx_rag_provider_costs_created
  ON rag_provider_costs(created_at DESC);

-- RLS: tenant isolation + filas system-wide (organization_id IS NULL)
ALTER TABLE rag_provider_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_provider_costs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_provider_costs_all ON rag_provider_costs;
CREATE POLICY rag_provider_costs_all ON rag_provider_costs
  FOR ALL
  USING (
    organization_id IS NULL
    OR organization_id = current_setting('app.current_org_id', TRUE)::UUID
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = current_setting('app.current_org_id', TRUE)::UUID
  );

COMMENT ON TABLE rag_provider_costs IS
  'Tracking de costos por proveedor/modelo/operación del sistema RAG. Tenant con organization_id NULLABLE: NULL = evento de sistema visible para todos, SET = tenant específico (RLS lo aísla).';
COMMENT ON COLUMN rag_provider_costs.alerta_spike IS
  'TRUE cuando el costo de este evento superó el threshold configurado. El monitor de costos lo usa para emitir alertas Slack #ops.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. VISTA: v_rag_metrics_7d — Resumen métricas RAG últimos 7 días
-- ══════════════════════════════════════════════════════════════════════════════
-- Agrega consultas RAG por tenant y día con percentiles de latencia,
-- similitud promedio, costo total y tasa de cache hit.
CREATE OR REPLACE VIEW v_rag_metrics_7d AS
SELECT
  organization_id,
  DATE_TRUNC('day', created_at)                                                        AS fecha,
  COUNT(*)                                                                            AS total_consultas,
  COUNT(DISTINCT user_id)                                                             AS usuarios_unicos,
  AVG(latency_ms)::INT                                                                AS latency_avg_ms,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY latency_ms)::INT                       AS latency_p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INT                       AS latency_p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::INT                       AS latency_p99_ms,
  AVG(similitud_promedio)                                                             AS similitud_avg,
  SUM(costo_usd)                                                                      AS costo_total_usd,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)
  END                                                                                 AS cache_hit_rate,
  SUM(chunks_usados)                                                                  AS total_chunks,
  SUM(citaciones_usadas)                                                              AS total_citaciones
FROM rag_audit_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY organization_id, DATE_TRUNC('day', created_at);

COMMENT ON VIEW v_rag_metrics_7d IS
  'Métricas agregadas RAG de los últimos 7 días por tenant y día: latencia (avg/p50/p95/p99), similitud, costo y cache hit rate.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. VISTA: v_rag_top_low_confidence — Materias/horas con baja similitud
-- ══════════════════════════════════════════════════════════════════════════════
-- Detecta "zonas calientes" donde la similitud promedio es < 0.60 — señal
-- de que el corpus no cubre bien esa materia o el retrieval está fallando.
-- Útil para priorización de mejora continua del corpus RAG.
--
-- NOTA: aunque la vista se llama "top_low_confidence", la métrica que usa
-- es similitud_promedio (de los chunks recuperados), no citaciones_verificadas.
-- Esto es intencional: la baja similitud precede a citaciones de mala calidad.
CREATE OR REPLACE VIEW v_rag_top_low_confidence AS
SELECT
  materia,
  DATE_TRUNC('hour', created_at)                                                       AS hora,
  COUNT(*)                                                                             AS total_consultas,
  COUNT(*) FILTER (WHERE similitud_promedio < 0.60)                                    AS consultas_baja_confianza,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE similitud_promedio < 0.60) / NULLIF(COUNT(*), 0),
    2
  )                                                                                    AS pct_baja_confianza,
  AVG(similitud_promedio)                                                              AS similitud_promedio_hora
FROM rag_audit_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY materia, DATE_TRUNC('hour', created_at)
HAVING COUNT(*) > 5
ORDER BY pct_baja_confianza DESC, total_consultas DESC;

COMMENT ON VIEW v_rag_top_low_confidence IS
  'Materias/horas con >5 consultas en las últimas 24h donde similitud_promedio < 0.60. Útil para detectar gaps en el corpus. Métrica: similitud_promedio (no citaciones).';


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. FUNCIÓN: fn_log_rag_query — Helper canónico para insertar audit log
-- ══════════════════════════════════════════════════════════════════════════════
-- Encapsula la inserción en rag_audit_log. Usado por el backend después de
-- cada consulta RAG. El hash SHA-256 de la consulta DEBE calcularse antes
-- (en backend) — esta función NO recibe el texto en claro para evitar PII.
CREATE OR REPLACE FUNCTION fn_log_rag_query(
  p_user_id                 UUID,
  p_organization_id         UUID,
  p_consulta_hash           TEXT,
  p_materia                 TEXT,
  p_chunks_usados           INT,
  p_similitud_promedio      DECIMAL,
  p_citaciones_usadas       INT,
  p_latency_ms              INT,
  p_costo_usd               DECIMAL,
  p_proveedor_embeddings    TEXT,
  p_cache_hit               BOOLEAN     DEFAULT FALSE,
  p_cache_layer             TEXT        DEFAULT 'none',
  p_correlation_id          TEXT        DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO rag_audit_log (
    user_id, organization_id, consulta_hash, materia,
    chunks_usados, similitud_promedio, citaciones_usadas,
    latency_ms, costo_usd, proveedor_embeddings,
    cache_hit, cache_layer, correlation_id
  ) VALUES (
    p_user_id, p_organization_id, p_consulta_hash, p_materia,
    p_chunks_usados, p_similitud_promedio, p_citaciones_usadas,
    p_latency_ms, p_costo_usd, p_proveedor_embeddings,
    p_cache_hit, p_cache_layer, p_correlation_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_log_rag_query IS
  'Helper canónico para insertar audit log RAG. La consulta se recibe YA hasheada (SHA-256) para evitar PII (LPDP Art. 4). Retorna el ID del audit creado.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. FUNCIÓN: fn_cleanup_old_rag_audit — Purga registros > N días
-- ══════════════════════════════════════════════════════════════════════════════
-- Llamada por un cron semanal (pg_cron o externo) para purgar logs viejos.
-- Default 90 días — alineado con retención operacional de logs RAG (los
-- audit log de LPDP Art. 23 tienen retención mayor y viven en audit_log,
-- no aquí).
CREATE OR REPLACE FUNCTION fn_cleanup_old_rag_audit(p_days_old INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF p_days_old IS NULL OR p_days_old < 1 THEN
    RAISE EXCEPTION 'p_days_old debe ser >= 1 (recibido: %)', p_days_old;
  END IF;

  DELETE FROM rag_audit_log
  WHERE created_at < NOW() - (p_days_old::TEXT || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_cleanup_old_rag_audit IS
  'Purga rag_audit_log mayores a N días (default 90). Retorna cantidad de filas eliminadas. Pensada para invocarse desde cron semanal.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 9. PERMISOS PARA ROLES DE APLICACIÓN
-- ══════════════════════════════════════════════════════════════════════════════
-- Garantiza que los roles creados en migraciones previas pueden usar las
-- tablas. ALTER DEFAULT PRIVILEGES (de 2026-08-01-multitenant-hardening.sql)
-- cubre objetos FUTUROS; aquí cubrimos los objetos creados AHORA.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legalpro_node') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_audit_log        TO legalpro_node;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_corpus_snapshot  TO legalpro_node;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_cache_stats      TO legalpro_node;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_provider_costs   TO legalpro_node;
    GRANT SELECT                          ON v_rag_metrics_7d   TO legalpro_node;
    GRANT SELECT                          ON v_rag_top_low_confidence TO legalpro_node;
    GRANT EXECUTE                         ON FUNCTION fn_log_rag_query          TO legalpro_node;
    GRANT EXECUTE                         ON FUNCTION fn_cleanup_old_rag_audit  TO legalpro_node;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legalpro_dotnet') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_audit_log        TO legalpro_dotnet;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_corpus_snapshot  TO legalpro_dotnet;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_cache_stats      TO legalpro_dotnet;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_provider_costs   TO legalpro_dotnet;
    GRANT SELECT                          ON v_rag_metrics_7d   TO legalpro_dotnet;
    GRANT SELECT                          ON v_rag_top_low_confidence TO legalpro_dotnet;
    GRANT EXECUTE                         ON FUNCTION fn_log_rag_query          TO legalpro_dotnet;
    GRANT EXECUTE                         ON FUNCTION fn_cleanup_old_rag_audit  TO legalpro_dotnet;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legalpro_app') THEN
    -- Rol legacy (2026-enable-rls.sql). Permisos de solo lectura para
    -- vistas + lectura/escritura para tablas (consistente con grants previos).
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_audit_log        TO legalpro_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_corpus_snapshot  TO legalpro_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_cache_stats      TO legalpro_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rag_provider_costs   TO legalpro_app;
    GRANT SELECT                          ON v_rag_metrics_7d   TO legalpro_app;
    GRANT SELECT                          ON v_rag_top_low_confidence TO legalpro_app;
    GRANT EXECUTE                         ON FUNCTION fn_log_rag_query          TO legalpro_app;
    GRANT EXECUTE                         ON FUNCTION fn_cleanup_old_rag_audit  TO legalpro_app;
  END IF;
END
$$;

COMMIT;


-- ══════════════════════════════════════════════════════════════════════════════
-- 10. SEED INICIAL — Snapshot del corpus alfa monetizable
-- ══════════════════════════════════════════════════════════════════════════════
-- Ejecutar FUERA de la transacción principal para no romper el COMMIT si
-- la fila ya existe. Usa ON CONFLICT sobre snapshot_name (UNIQUE constraint).
INSERT INTO rag_corpus_snapshot (
  snapshot_name, fuente, total_documentos, total_chunks,
  embedding_model, checksum_sha256, created_by
) VALUES (
  'alfa-monetizable-2026-08-01',
  'multi',
  319,
  800,
  'text-embedding-3-small',
  'sha256:placeholder_initial',
  'system'
)
ON CONFLICT (snapshot_name) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- 11. VERIFICACIÓN POST-MIGRACIÓN (output de referencia para QA)
-- ══════════════════════════════════════════════════════════════════════════════
-- Esperado:
--   • 4 tablas creadas
--   • 2 vistas creadas
--   • 2 funciones creadas
--   • rag_audit_log y rag_provider_costs: rls=TRUE, force_rls=TRUE
--   • rag_corpus_snapshot y rag_cache_stats: rls=FALSE (globales)
--   • rag_audit_log: 2 policies (SELECT + INSERT, sin UPDATE/DELETE)
--   • rag_provider_costs: 1 policy (FOR ALL con USING + WITH CHECK)
--   • 1 trigger (trg_rag_corpus_snapshot_updated_at)
--   • Índices: 5+3+1+5 = 14 índices (los IF NOT EXISTS los hacen idempotentes)
SELECT
  c.relname                                    AS tabla,
  c.relrowsecurity                             AS rls_habilitada,
  c.relforcerowsecurity                        AS rls_forzada,
  (SELECT COUNT(*) FROM pg_policies p
     WHERE p.schemaname = n.nspname AND p.tablename = c.relname
  )                                            AS num_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'rag_audit_log', 'rag_corpus_snapshot',
    'rag_cache_stats', 'rag_provider_costs'
  )
ORDER BY c.relname;
