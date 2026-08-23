# RB-012: Spike de Costo IA (Tenant específico)

## Metadata
- **Severidad**: P1
- **Owner**: @PlataformaFinanzas + @OwnerAdmin
- **Última actualización**: 2026-06-12

## Síntomas
- Tenant consume > 5x su plan
- Costo mensual proyectado > 1.5x del plan

## Pasos

1. Verificar: `verifier-cost-spike.mjs`
2. Revisar `consumo_tokens_ia` del tenant
3. Identificar herramienta que más consume
4. Posibles causas: feature nueva, bug, abuse
5. Contactar al tenant
6. Sugerir upgrade de plan
7. Si es abuse: `RB-018-tenant-suspicious.md`
8. Si no resuelve: downgrade automático a plan anterior

## Compliance
- LPDP: no afecta
- Contractual: ToS permite downgrade

## Comunicación
- Slack: #ops
- Email: al tenant
