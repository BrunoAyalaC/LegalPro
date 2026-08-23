-- Artefacto generado: RLS defense-in-depth para LegalPro
-- Aislamiento por contexto: SET app.current_org_id = '<uuid>' por request/transaccion.
-- NO usa FORCE: el owner/superusuario (postgres) sigue operando sin romperse.
-- Para ENFORCAR realmente, la app debe conectar con un rol NO-superusuario (legalpro_app).

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_usuarios ON public.usuarios;
CREATE POLICY tenant_isolation_usuarios ON public.usuarios USING (organizacion_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.miembros_organizacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_miembros_organizacion ON public.miembros_organizacion;
CREATE POLICY tenant_isolation_miembros_organizacion ON public.miembros_organizacion USING (organizacion_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_expedientes ON public.expedientes;
CREATE POLICY tenant_isolation_expedientes ON public.expedientes USING (organizacion_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.simulaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_simulaciones ON public.simulaciones;
CREATE POLICY tenant_isolation_simulaciones ON public.simulaciones USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.eventos_simulacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_eventos_simulacion ON public.eventos_simulacion;
CREATE POLICY tenant_isolation_eventos_simulacion ON public.eventos_simulacion USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.invitaciones_organizacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_invitaciones_organizacion ON public.invitaciones_organizacion;
CREATE POLICY tenant_isolation_invitaciones_organizacion ON public.invitaciones_organizacion USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.mensajes_chat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_mensajes_chat ON public.mensajes_chat;
CREATE POLICY tenant_isolation_mensajes_chat ON public.mensajes_chat USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.notificaciones_sinoe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_notificaciones_sinoe ON public.notificaciones_sinoe;
CREATE POLICY tenant_isolation_notificaciones_sinoe ON public.notificaciones_sinoe USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.evidencia_digital ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_evidencia_digital ON public.evidencia_digital;
CREATE POLICY tenant_isolation_evidencia_digital ON public.evidencia_digital USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.predicciones_judiciales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_predicciones_judiciales ON public.predicciones_judiciales;
CREATE POLICY tenant_isolation_predicciones_judiciales ON public.predicciones_judiciales USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.estrategias_interrogatorio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_estrategias_interrogatorio ON public.estrategias_interrogatorio;
CREATE POLICY tenant_isolation_estrategias_interrogatorio ON public.estrategias_interrogatorio USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_audit_log ON public.audit_log;
CREATE POLICY tenant_isolation_audit_log ON public.audit_log USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_suscripciones ON public.suscripciones;
CREATE POLICY tenant_isolation_suscripciones ON public.suscripciones USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON public.audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON public.audit_logs USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.consumo_tokens_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_consumo_tokens_ia ON public.consumo_tokens_ia;
CREATE POLICY tenant_isolation_consumo_tokens_ia ON public.consumo_tokens_ia USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.transacciones_creditos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_transacciones_creditos ON public.transacciones_creditos;
CREATE POLICY tenant_isolation_transacciones_creditos ON public.transacciones_creditos USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_documentos ON public.documentos;
CREATE POLICY tenant_isolation_documentos ON public.documentos USING (organization_id::text = current_setting('app.current_org_id', true));

ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_organizaciones ON public.organizaciones;
CREATE POLICY tenant_isolation_organizaciones ON public.organizaciones USING (id::text = current_setting('app.current_org_id', true));

-- Rol de minimos privilegios (la app debe usar este rol en produccion)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='legalpro_app') THEN CREATE ROLE legalpro_app LOGIN PASSWORD 'CAMBIAR_EN_DEPLOY' NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public TO legalpro_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legalpro_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legalpro_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO legalpro_app;
