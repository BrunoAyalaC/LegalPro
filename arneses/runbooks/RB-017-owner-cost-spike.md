# RB-017: Spike de Costo en Plataforma (Owner)

## Metadata

- **Severidad**: P1
- **Categoría**: cost, finance
- **Owner**: @PlataformaFinanzas
- **SLO afectado**: Costo mensual < presupuesto
- **Última actualización**: 2026-06-12

## Síntomas

- Alerta de `verifier-cost-spike.mjs`: "Mes actual > 2x promedio 3 meses"
- Owner reporta en dashboard que el costo mensual está disparado
- Alerta en Slack #ops: `OWNER_ALERT_COST_SPIKE`
- Un tenant específico consume > 5x el promedio de su plan

## Diagnóstico

### Paso 1: Identificar el origen

- [ ] Ejecutar `node tools/verifiers/verifier-cost-spike.mjs`
- [ ] Revisar dashboard del owner: filtro por tenant
- [ ] Identificar: ¿es un tenant outlier o es sistémico?

### Paso 2: Causa raíz

- [ ] ¿Tenant específico con consumo anómalo?
  - Revisar su historial en `consumo_tokens_ia`
  - Revisar `audit_log` con `event_name = GEMINI_REQUEST`
  - Posible: bug en su integración / uso automatizado
- [ ] ¿Es sistémico (toda la plataforma)?
  - Posible: cambio de pricing de Gemini
  - Posible: feature nueva ineficiente
  - Posible: ataque de abuse

### Paso 3: Decidir acción

- [ ] **Caso 1**: Tenant outlier → contactar al tenant, ofrecer upgrade o limitar
- [ ] **Caso 2**: Sistémico → investigar cambio reciente (deploy, modelo)
- [ ] **Caso 3**: Abuse → suspender tenant + investigar + breach notification si aplica

## Mitigación

### Inmediata (< 30 min)

- [ ] Si es un tenant: `OwnerAdmin.suspender_tenant()` con notificación 24h
- [ ] Si es sistémico: `OwnerAdmin.cambiar_modelo_global()` a `gemini-2.5-flash-lite`
- [ ] Activar rate limit global más estricto

### Corto plazo (< 24h)

- [ ] Comunicar a los tenants afectados
- [ ] Auditar el cambio que disparó el spike
- [ ] Considerar refactor de prompts (menos tokens)
- [ ] Considerar upgrade de plan o downgrade de uso

### Definitiva (< 1 semana)

- [ ] Post-mortem con timeline
- [ ] Ajustar `verifier-cost-spike.mjs` thresholds
- [ ] Implementar circuit breaker si no existe
- [ ] Comunicar a stakeholders

## Rollback

Si el spike es por cambio de modelo a Pro:

```bash
railway env set GEMINI_MODEL_DEFAULT=gemini-2.5-flash-lite --service legalpro-dotnet
railway env set GEMINI_MODEL_DEFAULT=gemini-2.5-flash-lite --service legalpro-node
```

## Comunicación

- Slack: #ops (interno) + #status
- Email: tenants afectados
- Status page: si > 1h
- Reporte a dirección: semanal

## Compliance

- LPDP: cambios de plan deben respetar derecho de desistimiento
- Contractual: PRO $1000/mes, ENTERPRISE $5000/mes (ver `catalogs/role-tools.json`)
