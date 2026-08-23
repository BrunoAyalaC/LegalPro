# RB-008: Deploy Falló

## Metadata
- **Severidad**: P2
- **Owner**: @DevOps + @ReleaseManager
- **Última actualización**: 2026-06-12

## Síntomas
- CI falla en build
- Railway deploy failed
- Imagen Docker no compila

## Pasos
1. Revisar logs de CI
2. Si es error de test: fix
3. Si es error de build: fix dependencias
4. Si es error de docker: revisar Dockerfile
5. Si es error de env: revisar variables
6. Rollback al último release estable
7. Re-deploy después de fix

## Compliance
- LPDP: rollback no afecta datos
- ISO 27001: control de cambios

## Comunicación
- Slack: #ops
- Email: stakeholders
