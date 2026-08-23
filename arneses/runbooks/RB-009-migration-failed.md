# RB-009: Migración SQL Falló

## Metadata
- **Severidad**: P0
- **Owner**: @Database + @SRE
- **Última actualización**: 2026-06-12

## Síntomas
- Alerta: `MIGRATION_FAILED` severity CRITICAL
- Rollback automático no funcionó
- Datos inconsistentes

## Pasos
1. NO seguir deployando hasta resolver
2. Identificar la migración que falló
3. Evaluar si los datos son consistentes
4. Si hay inconsistencia: backup + restore
5. Fix la migración (versión, sintaxis, RLS)
6. Re-correr en staging
7. Re-correr en prod con supervisión
8. Post-mortem

## Compliance
- LPDP: data consistency crítica
- ISO 27001: control de cambios

## Comunicación
- Slack: #ops + #lpdp
- Email: stakeholders
