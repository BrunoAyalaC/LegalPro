# RB-002: Brute Force Detectado

## Metadata
- **Severidad**: P1
- **Owner**: @AuditorSeguridad + @SRE
- **Última actualización**: 2026-06-12

## Síntomas
- Alerta: `BRUTE_FORCE_DETECTED` severity CRITICAL
- `BruteForceProtectionMiddleware` dispara lockout
- Spike de AUTH_LOGIN_FAILURE en `audit_log`

## Pasos
1. Confirmar: revisar `audit_log` con `event_name = BRUTE_FORCE_DETECTED`
2. Localizar: IP, endpoint, attempts, lockout_until
3. Decidir: ¿es legítimo (olvido de password) o es ataque?
4. Si ataque: bloquear IP en WAF, alertar
5. Si legítimo: contactar al usuario
6. Incrementar lockout si es ataque sostenido
7. Si persiste, considerar ban permanente

## Compliance
- LPDP: log del intento (sin PII)
- ISO 27001 A.13.1.1

## Comunicación
- Slack: #security
- Email: CISO si > 100 intentos
