# RB-003: Cross-Tenant Data Leak

## Metadata
- **Severidad**: P0
- **Owner**: @AuditorMultiTenant + @SRE
- **Última actualización**: 2026-06-12

## Síntomas
- Alerta: `TENANT_VIOLATION` severity ERROR
- Token de org A accediendo a datos de org B
- Tests E2E cross-tenant fallan

## Pasos
1. CONFENIR INMEDIATAMENTE el endpoint afectado
2. Identificar la query que falló (en `audit_log`)
3. Buscar el `IgnoreQueryFilters()` o falta de `ITenantRequest`
4. Si es hotfix: corregir + merge + redeploy
5. Identificar todos los datos accedidos por el tenant atacante
6. Si PII: activar `RB-010-lpdp-breach.md`
7. Comunicar a AMBOS tenants (A y B)
8. Post-mortem: cómo evitar que vuelva a pasar

## Compliance
- LPDP: notificación <= 5 días si breach
- LPDP Art. 207-A: penal si negligencia
- Contractual: breach de ToS

## Comunicación
- Slack: #security + #lpdp
- Email: tenants afectados + CISO + CTO
- Status page si afecta usuarios
