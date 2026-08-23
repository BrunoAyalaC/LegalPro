# RB-013: SLO Violation

## Metadata
- **Severidad**: P2
- **Owner**: @SRE
- **Última actualización**: 2026-06-12

## Síntomas
- Latencia p95 > 2x SLO
- Error rate > 1%
- Availability < 99.5%

## Pasos

1. Identificar el endpoint afectado
2. Revisar logs y métricas
3. Si es deploy reciente: rollback
4. Si es carga: escalar
5. Si es query lento: optimizar
6. Si es Gemini: cambiar modelo
7. Post-mortem

## Compliance
- ISO 27001 A.12.4
- Contractual: SLA con clientes

## Comunicación
- Slack: #ops
- Status page si > 30min
