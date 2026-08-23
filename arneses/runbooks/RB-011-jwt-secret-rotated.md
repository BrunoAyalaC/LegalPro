# RB-011: Rotación de JWT_SECRET

## Metadata
- **Severidad**: P2 (programado)
- **Owner**: @DevOps + @AuditorSeguridad
- **Última actualización**: 2026-06-12

## Pasos

1. Generar nuevo secret con `openssl rand -base64 48`
2. Actualizar en Railway: `railway env set JWT_SECRET=$NEW_SECRET`
3. Esperar 5 min para que la app use el nuevo secret
4. **NO** invalidar tokens inmediatamente (causa logout masivo)
5. Monitorear errores de auth
6. Después de 24h, considerar blacklist de tokens viejos
7. Auditar en `audit_log` con `event_name = SECRETS_ROTATION`

## Compliance
- LPDP: tokens no son PII
- ISO 27001 A.10.1
- PCI: si aplica

## Comunicación
- Slack: #ops (interno)
- Usuarios: notificar si hay logout
