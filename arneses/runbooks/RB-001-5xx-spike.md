# RB-001: Spike de Errores 5xx

## Metadata

- **Severidad**: P1
- **Categoría**: availability
- **SLO afectado**: error rate < 0.1% (5xx)
- **Owner**: @SRE
- **Última actualización**: 2026-06-12

## Síntomas

- Alerta de Sentry/Datadog: "Error rate 5xx > 1% en 5min"
- Spike en logs de `ExceptionHandlingMiddleware`
- Usuarios reportan "Internal Server Error"
- Métrica de error_rate_5xx sube en Grafana

## Diagnóstico

### Paso 1: Confirmar

- [ ] Verificar dashboard: `<grafana-url>/d/error-rate`
- [ ] Revisar logs: `grep "5xx" /var/log/legalpro/ | tail -100`
- [ ] Validar métrica en Datadog: `error_rate_5xx{service=*}.as_count()`

### Paso 2: Localizar

- [ ] ¿Qué servicio está afectado? (legalpro-node / legalpro-dotnet / frontend)
- [ ] ¿Es un endpoint específico o sistémico?
- [ ] ¿Coincide con un deploy reciente? (git log --since="1 hour ago")
- [ ] ¿Coincide con una migración? (ver `audit_log` eventos `MIGRATION_*`)

### Paso 3: Causa raíz

- [ ] Deploy reciente con bug -> rollback
- [ ] Dependencia externa caída (Gemini, Supabase, Railway)
- [ ] Cuota excedida (Gemini)
- [ ] Memory leak (RAM > 95%)
- [ ] Conexión DB saturada (pool exhausted)

## Mitigación

### Inmediata (< 5 min)

```bash
# Si es por deploy reciente
./rollback.sh legalpro-node vX.Y.Z-1
./rollback.sh legalpro-dotnet vX.Y.Z-1
```

### Corto plazo (< 30 min)

- [ ] Si es Gemini: cambiar a modelo más barato temporalmente (`gemini-2.5-flash-lite`)
- [ ] Si es DB: matar conexiones idle, restart pool
- [ ] Si es RAM: restart del servicio

### Definitiva (< 24h)

- [ ] Identificar la causa raíz con post-mortem
- [ ] Crear test que reproduzca el bug
- [ ] PR con fix + test
- [ ] Actualizar runbook con lecciones aprendidas

## Rollback

Si no se puede mitigar, ejecutar rollback al release anterior:

```bash
git tag  # ver ultimo tag estable
railway rollback --service legalpro-node --to vX.Y.Z
railway rollback --service legalpro-dotnet --to vX.Y.Z
```

## Post-mortem

- [ ] Crear `arneses/post-mortems/PM-001-5xx-spike.md`
- [ ] Timeline completo
- [ ] 5 whys
- [ ] Acciones correctivas con dueño

## Comunicación

- Slack: #ops (interno) + #status (público si afecta usuarios)
- Status page: actualizar
- Email: stakeholders si > 30 min
