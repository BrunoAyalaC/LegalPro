# RB-XXX: <Título del Runbook>

## Metadata

- **Severidad**: P0 | P1 | P2 | P3
- **Categoría**: security | availability | performance | compliance | data
- **SLO afectado**: ver `catalogs/sla-slo.md`
- **Owner**: @<rol>
- **Última actualización**: YYYY-MM-DD

## Síntomas

- <síntoma observable 1>
- <síntoma observable 2>
- <métrica que dispara alerta>

## Diagnóstico

### Paso 1: Confirmar

- [ ] Verificar dashboard: <URL>
- [ ] Revisar logs: `grep -E "pattern" /var/log/...`
- [ ] Validar métrica: <métrica>

### Paso 2: Localizar

- [ ] ¿Qué servicio está afectado? (node/dotnet/frontend/android)
- [ ] ¿Qué región? (Railway)
- [ ] ¿Es aislado o sistémico?

### Paso 3: Escalar causa raíz

- [ ] Revisar deploys recientes
- [ ] Revisar migraciones recientes
- [ ] Revisar cambios de config
- [ ] Revisar eventos externos (Gemini, Supabase, BCRP)

## Mitigación

### Mitigación inmediata (< 5 min)

- [ ] <acción 1>
- [ ] <acción 2>

### Mitigación de corto plazo (< 30 min)

- [ ] <acción 3>
- [ ] <acción 4>

### Mitigación definitiva (< 24h)

- [ ] <acción 5>
- [ ] <acción 6>

## Rollback

Si la mitigación no funciona, ejecutar rollback:

```bash
<comando de rollback>
```

## Post-mortem

- [ ] Crear post-mortem en `arneses/post-mortems/PM-XXX.md`
- [ ] Asignar acciones correctivas
- [ ] Actualizar este runbook con lecciones aprendidas

## Comunicación

- Slack: #ops (interno) + #status (público si afecta usuarios)
- Email: <lista de distribución>
- Status page: <URL>

## Referencias

- `catalogs/sla-slo.md`
- `catalogs/audit-events.json`
- Otros runbooks: RB-001, RB-002...
