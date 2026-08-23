# ADR-004: Rollout de la ola de fixes — MFA (C-01) POSTERGADO, consentimientos RLS CONDICIONADO

> **Status**: Accepted  
> **Date**: 2026-08-07  
> **Deciders**: @abogado-chief  
> **Firmado por**: @abogado-chief  

## Context and Problem Statement

En producción (Railway `https://legalpro-node-production-34ac.up.railway.app`, imagen `brunoayala97/legalpro-node-api:v6.12.9`) el login demo funciona con `routes/auth.js`. Un subagente @auditor-seguridad aplicó el fix C-01: reordenó `server/index.js` para que `POST /api/auth/login` lo maneje `routes/auth-login-mfa.js` (MFA + bruteForceMiddleware) en lugar de `auth.js`.

Se identifican DOS bloqueadores que hacen INVIABLE el rollout de C-01 en esta iteración:

1. **Esquema inexistente**: la tabla `usuarios` NO tiene `mfa_enabled`, `mfa_secret`, `mfa_required_setup`, `mfa_backup_codes`. `auth-login-mfa.js` hace `SELECT ... mfa_enabled, mfa_secret ...` → error SQL en CADA login → indisponibilidad total (P0).
2. **Frontend sin flujo MFA**: aunque se migraran columnas, los roles sensibles (ABOGADO/FISCAL/JUEZ — que son 3 de los 5 roles demo) recibirían `mfaSetupRequired:true` sin token; `Login.jsx`/`TenantContext.tsx` no tienen pantallas `/mfa-verificar` ni `/mfa-configurar` → el login que hoy funciona se rompería funcionalmente.

Adicionalmente, la migración `server/migrations/2026-08-07-fix-consentimientos-rls.sql` (consentimientos/refresh_tokens/evidencia_accesos) es NECESARIA por LPDP pero tiene un riesgo operacional: `FORCE RLS` sobre `refresh_tokens` mientras el backend escribe esa tabla con `db.query` directo (sin `set_config('app.current_org_id')`).

## Decision Drivers

- **Disponibilidad del sistema** (no romper el login en producción): driver dominante.
- **Cumplimiento LPDP (Ley 29733)**: consentimiento demostrable (Art. 8 responsabilidad demostrada, Art. 21 revocación).
- **Seguridad OWASP A07-2021**: MFA para roles con acceso a datos de terceros (diligencia debida, no requisito expreso LPDP).
- **Multi-tenant estricto**: RLS fail-closed sin regresiones en flujos de auth.
- **Alfa monetizable**: no introducir bloqueadores innecesarios.

## Considered Options

### Option 1: Desplegar C-01 AHORA (auth-login-mfa.js activo)

- **Pros**: MFA "activo" en una iteración.
- **Cons**: ERROR SQL en cada login (columnas inexistentes) → indisponibilidad total del SaaS legal. Aun con migración, roles demo sensibles quedan fuera → daño irreparable a defensa de clientes (plazos procesales, prescripción). **RECHAZADA**.

### Option 2: Postergar C-01 a iteración dedicada MFA (revertir reorder; auth.js sigue manejando /login)

- **Pros**: Login demo sigue funcionando; el resto de la ola de fixes avanza; MFA se hace completo (migración + UI + activación gradual).
- **Cons**: MFA no está activo todavía (riesgo de acceso aceptado, mitigado por brute-force limiter existente).
- **ELEGIDA** para C-01.

### Option 3: Migración RLS consentimientos incondicional

- **Pros**: Cumple LPDP Art. 8.
- **Cons**: `FORCE RLS` en `refresh_tokens` sin backend alineado puede romper login/refresh si el rol de conexión no es BYPASSRLS. **RECHAZADA como ejecución incondicional; aprobada CON condiciones**.

## Decision Outcome

**Chosen option**: 
1. **C-01 (login MFA) → POSTERGADO** a iteración dedicada MFA. Se revierte el reorder en `index.js` para que `auth.js` siga manejando `POST /api/auth/login`. El código de `auth-login-mfa.js` se conserva íntegro para su activación posterior.
2. **Migración RLS consentimientos → APRUEBO CON CONDICIONES** (ver tabla de condiciones).
3. **Resto de la ola → GO** con orden de prioridad definido.

### Condiciones del GO para la migración SQL (NO NEGOCIABLES)

| # | Condición | Responsable | Verificador |
|---|-----------|-------------|-------------|
| M1 | Backup completo (`pg_dump`) antes de ejecutar | @database | Backup verificado en storage externo |
| M2 | Verificar rol de conexión del backend: si NO es BYPASSRLS, alinear el backend a `tenantQuery`/`set_config` para `refresh_tokens` ANTES de activar el BLOQUE 2, o ejecutar la migración por bloques (0-1-3 primero, 2 después) | @backend-node + @arquitecto-chief | Smoke test de login + refresh post-ejecución |
| M3 | Second-approval de @GobernanzaChief (LPDP) y @arquitecto-chief (técnico) | @gobernanza-chief, @arquitecto-chief | Firma en este ADR |
| M4 | Ejecutar en ventana de mantenimiento + test funcional cross-tenant del archivo (cross_tenant = 0) | @database | Salida del BLOQUE 4 + test manual |
| M5 | Plan de rollback listo: `DROP POLICY tenant_isolation_*` + `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` | @database | Runbook documentado |

### Riesgo Legal/Operacional Principal

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Desplegar C-01 sin esquema MFA → 500 en todo login | Alta (1.0 si se ejecuta) | CRÍTICO — indisponibilidad SaaS legal | Revertir reorder; postergar C-01 |
| Frontend sin flujo MFA → roles sensibles sin acceso | Alta (0.9) | ALTO — abogados sin acceso a expedientes/plazos | Iteración dedicada con UI + activación gradual |
| FORCE RLS refresh_tokens rompe login si rol NOBYPASSRLS | Media (0.5) | ALTO — login/refresh 500 | Condición M2 (backend alineado o por bloques) |
| No ejecutar migración consentimientos → deny-all LPDP | Segura (hoy ya deny-all) | ALTO — sanción ANPDP (hasta 100 UIT), no demostrable Art. 8 | Condiciones M1-M5 |

### Compliance

- **LPDP Ley 29733 Art. 8 y 21**: la migración de consentimientos habilita demostrar consentimiento y su revocación. Bloqueante de cumplimiento → se autoriza condicionado.
- **OWASP A07-2021**: MFA programado en iteración dedicada; hoy mitigado por brute-force limiter (10 intentos/15 min, `authLimiter`).
- **OWASP LLM / disclaimers IA**: disclaimer en frontend ya integrado (IADisclaimerBanner/Modal) → GO.

## Pros and Cons of the Options

### Option 1 — C-01 ahora

- **Pros**: rapidez aparente.
- **Cons**: indisponibilidad total (error SQL), roles demo rotos, riesgo de prescripción/caducidad de plazos para clientes, responsabilidad civil (CC art. 1321) y penal (CP art. 207-A) si deriva en breach. **Rechazada**.

### Option 2 — Postergar C-01

- **Pros**: disponibilidad preservada; MFA completo (migración + UI + gradual) en iteración propia; contrato login híbrido ya listo en `client.ts` y compatible hacia atrás.
- **Cons**: MFA no activo temporalmente (riesgo aceptado, mitigado).

### Option 3 — Migración incondicional

- **Pros**: velocidad de cumplimiento.
- **Cons**: riesgo de romper login por FORCE RLS en refresh_tokens. **Rechazada como incondicional**.

## Links

- ADRs relacionados: [ADR-003-release-v1.0.0-sign-off](./ADR-003-release-v1.0.0-sign-off.md), [ADR-001-clean-architecture-dotnet](./ADR-001-clean-architecture-dotnet.md)
- Código: `legalpro-app/server/index.js`, `legalpro-app/server/routes/auth-login-mfa.js`, `legalpro-app/server/routes/auth.js`, `legalpro-app/server/migrations/2026-08-07-fix-consentimientos-rls.sql`, `legalpro-app/server/utils/jwt.js`, `legalpro-app/server/db.js`
- Catálogos: `catalogs/codigos-leyes.json` (Ley 29733, Ley 27269), `catalogs/reguladores-peru.json` (ANPDP), `catalogs/disclaimers-ia.json`
- Reportes: `reports/OWASP-AUDIT-2026-06-28.md` (fix SQL $5)

---

## Firma del Abogado Chief

```
Yo, @abogado-chief, como máxima autoridad jurídica del arnés LegalPro,
habiendo revisado:

✅ server/index.js — reorder C-01 aplicado en working tree (líneas 480-481)
✅ auth-login-mfa.js — SELECT columnas mfa inexistentes (líneas 24-30)
✅ init.sql — usuarios SIN columnas mfa (líneas 121-136)
✅ NO existe migración *mfa*.sql en el repositorio
✅ Frontend Login.jsx/TenantContext.tsx SIN flujo MFA (sin /mfa-verificar ni /mfa-configurar)
✅ client.ts — contrato login híbrido tolerante (retro-compatible)
✅ clientes.js — fix SQL $5 ya aplicado (placeholders dinámicos + allowlist)
✅ Migración 2026-08-07-fix-consentimientos-rls.sql — idempotente, transaccional, con verificación
✅ Riesgo FORCE RLS refresh_tokens con db.query directo (jwt.js/auth-login-mfa.js)

DECISIONES:

1. C-01 (login MFA activo) → ❌ RECHAZO AHORA → POSTERGO a iteración
   dedicada MFA (migración columnas + UI /mfa-verificar y /mfa-configurar
   + activación gradual por feature flag). Se revierte el reorder en
   index.js para preservar disponibilidad del login.

2. Migración de columnas MFA → NO bloqueante para alfa monetizable.
   Prioridad MEDIA (P2) en iteración MFA. Puede esperar.

3. Resto de la ola → ✅ GO con orden: (P0) fix SQL $5 clientes.js y
   migración RLS consentimientos condicionada; (P1) fix audit_log y
   disclaimer frontend; (P2) contrato login híbrido y .NET health/claims.

4. Migración SQL consentimientos/refresh_tokens/evidencia_accesos →
   ✅ APRUEBO CON CONDICIONES (M1-M5): backup, verificación de rol
   de conexión / alineación backend, second-approval, ventana de
   mantenimiento con smoke test, plan de rollback.

Fecha: 2026-08-07
```
