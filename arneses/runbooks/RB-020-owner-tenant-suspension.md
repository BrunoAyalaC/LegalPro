# RB-020: Suspensión de Tenant (Owner)

## Metadata

- **Severidad**: P2
- **Categoría**: admin, operations
- **Owner**: @OwnerAdmin
- **Última actualización**: 2026-06-12
- **Marco legal**: ToS, derecho de desistimiento (LPDP), notificación previa 7 días

## Síntomas

- Tenant con pagos atrasados (3+ meses)
- Tenant que viola ToS (uso no permitido)
- Tenant sospechoso (ver `RB-018`)
- Solicitud del propio tenant (cancelación)
- Compliance: orden judicial, solicitud ANPDP

## Proceso

### Paso 1: Justificar

- [ ] Documentar razón (ToS violation, no-pago, solicitud del tenant, orden legal)
- [ ] Verificar que NO es arbitrario (cumple ToS)
- [ ] Verificar contratos vigentes (ENTERPRISE puede tener cláusulas)

### Paso 2: Pre-suspensión (Días -7 a -1)

- [ ] Email 1 (7 días antes): aviso formal
  - Plantilla en `arneses/templates/EMAIL-SUSPENSION-WARNING.template.md`
  - Incluir: razón, fecha efectiva, opciones (resolver, exportar datos)
- [ ] Email 2 (3 días antes): recordatorio
- [ ] Email 3 (1 día antes): último aviso
- [ ] Permitir exportar datos ARCO hasta fecha efectiva

### Paso 3: Día de suspensión

- [ ] Verificar que no hay actividad legítima
- [ ] `UPDATE organizaciones SET is_active = false, deleted_at = NOW() WHERE id = X;`
- [ ] `UPDATE refresh_tokens SET revoked = true WHERE user_id IN (...)`
- [ ] Backup de los datos del tenant (soft-delete con retention)
- [ ] Email de suspensión efectiva
- [ ] Audit log: `OWNER_ACTION_SUSPEND_TENANT`

### Paso 4: Post-suspensión

- [ ] Mantener datos por retention period (configurable, default 90 días)
- [ ] Si reactivan: `UPDATE organizaciones SET is_active = true, deleted_at = NULL`
- [ ] Si confirman cancelación: activar `RB-021-tenant-cancellation`

## Compliance

### LPDP

- ✅ Respetar derecho de ARCO antes de suspender (exportar)
- ✅ Retención: max 90 días después de suspensión
- ✅ Luego: hard delete con notificación previa
- ❌ NO eliminar datos inmediatamente (derecho de recuperación)

### Contractual

- ENTERPRISE: revisar MSA (Master Service Agreement)
- PRO/FREE: ToS aplica
- Free trial: condiciones especiales

### Notificación

- 3 emails (7d, 3d, 1d)
- Email final con motivo y opciones
- Idioma: español + inglés si es tenant internacional

## Reversibilidad

- ✅ Reactivable mientras retención < 90 días
- ❌ No reactivable después de hard delete

## Referencias

- `catalogs/owner-dashboard.json` (acciones owner)
- `catalogs/role-tools.json` (planes)
- `catalogs/audit-events.json` (OWNER_ACTION_*)
- `tools/verifiers/verifier-tenant-leak.mjs`
