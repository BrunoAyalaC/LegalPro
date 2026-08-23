# RB-018: Tenant Sospechoso (Owner)

## Metadata

- **Severidad**: P1
- **Categoría**: security, abuse
- **Owner**: @OwnerAdmin + @AuditorSeguridad
- **Última actualización**: 2026-06-12

## Síntomas

- Alerta: `verifier-cost-spike.mjs` detecta tenant con > 5x del promedio
- Logs muestran requests de IPs sospechosas (tor exit nodes, VPN anómalas)
- Patrones de uso automatizado (bots, scripts)
- Intentos de brute force en login
- Reporte de otro tenant sobre uso fraudulento

## Diagnóstico

### Paso 1: Confirmar

- [ ] Revisar `audit_log` del tenant: AUTH_LOGIN_FAILURE rate
- [ ] Revisar `consumo_tokens_ia` del tenant: requests/hora
- [ ] Revisar patrones temporales: ¿es en horas laborales o 24/7?
- [ ] Geolocalización: ¿son requests de países esperados?

### Paso 2: Categorizar

- [ ] **Abuso de试用**: trial abuse (crear muchos trials)
- [ ] **Cuenta comprometida**: tokens robados
- [ ] **Uso automatizado malicioso**: scrapers, abuse de IA
- [ ] **Comportamiento legítimo pero inesperado**: feature nueva del tenant

### Paso 3: Decidir severidad

- [ ] **HIGH**: sospecha de compromiso o abuso masivo
  - Acción inmediata: suspender + investigar
- [ ] **MEDIUM**: comportamiento anómalo pero no confirmado
  - Acción: contactar al tenant, pedir explicación
- [ ] **LOW**: picos esporádicos
  - Acción: monitorear

## Mitigación

### Inmediata (sospecha de compromiso)

```bash
# Suspender tenant
UPDATE organizaciones SET is_active = false,
  deleted_at = NOW()
WHERE id = '<tenant-id>';

# Revocar todos los tokens
UPDATE refresh_tokens SET revoked = true, revoked_reason = 'SECURITY_INCIDENT'
WHERE user_id IN (SELECT id FROM usuarios WHERE organization_id = '<tenant-id>');

# Bloquear IPs sospechosas en WAF
```

### Corto plazo

- [ ] Forzar reset de contraseñas
- [ ] Auditar toda la actividad del tenant
- [ ] Notificar al contacto del tenant
- [ ] Si hay evidencia de breach: activar `RB-010-lpdp-breach.md`

### Definitiva

- [ ] Post-mortem
- [ ] Mejorar detección de anomalías
- [ ] Agregar CAPTCHA si no existe
- [ ] Mejorar rate limit
- [ ] Considerar MFA obligatorio para casos sospechosos

## Compliance

- LPDP: si hay evidencia de breach, activar `RB-010`
- Contractual: ToS permite suspensión por abuse
- Comunicación: 7 días de preaviso si no es abuse

## Referencias

- `catalogs/owner-dashboard.json` (acciones del owner)
- `catalogs/audit-events.json` (eventos)
- `tools/verifiers/verifier-cost-spike.mjs`
- `tools/verifiers/verifier-multi-tenant.mjs`
