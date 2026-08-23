# RB-016: Token Replay Detected

## Metadata
- **Severidad**: P1
- **Owner**: @AuditorSeguridad + @SRE
- **Última actualización**: 2026-06-12

## Síntomas
- Mismo token JWT usado desde 2+ IPs en < 1 min
- Token refresh usado después de logout
- Sesión activa en 2 países simultáneamente

## Pasos

1. Identificar el token en `audit_log`
2. Revocar todas las sesiones del usuario
3. Forzar reset de password
4. Si es PII: evaluar breach
5. Investigar vector: ¿phishing, malware, robo?
6. Bloquear IP de origen
7. Notificar al usuario
8. Post-mortem

## Compliance
- LPDP: 5 días hábiles si breach
- ISO 27001 A.13.1.1

## Comunicación
- Slack: #security
- Email: usuario + CISO
