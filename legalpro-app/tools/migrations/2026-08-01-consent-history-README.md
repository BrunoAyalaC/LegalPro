# Migración de Historial de Consentimientos (LPDP Art. 21) — 2026-08-01

> **FIX LPDP-3.5** — Bitácora inmutable de otorgamientos, revocaciones y
> modificaciones de consentimiento para auditoría regulatoria.

---

## Contexto

### Hallazgo LPDP-3.5 (Auditoría LPDP)

| # | Riesgo detectado | Impacto |
|---|------------------|---------|
| 1 | La tabla `consentimientos` solo registra el **último estado** por usuario/tipo (insertar y re-insertar para revocar). | No hay forma de auditar **quién consintió qué versión y cuándo**, ni distinguir entre consentimiento original y re-consentimiento tras cambio de versión. |
| 2 | La revocación es **soft-revoke** (insertar con `aceptado=FALSE`) pero no hay un registro federal inmutable. | En una auditoría, no se puede reconstruir la cronología completa de otorgamientos y revocaciones. |
| 3 | No se registra la **versión del documento legal** que el usuario aceptó (`terminos_v1.0`, `privacidad_v2.1`, etc.). | Si cambia la política de privacidad, no se puede demostrar qué versión específica aceptó el titular en cada momento. |

### Base legal incumplida

- **Ley 29733 — Art. 21**: el titular puede revocar su consentimiento en
  cualquier momento, sin efecto retroactivo. El banco de datos debe
  documentar tanto el otorgamiento como la revocación.
- **Ley 29733 — Art. 8 (Principio de Responsabilidad)**: el titular del
  banco de datos debe **adoptar las medidas necesarias** para demostrar
  el cumplimiento de los principios de la ley.
- **D.S. 016-2024-JUS — Art. 21**: el registro de tratamiento debe
  contemplar la base legal del consentimiento y los plazos de retención.

### Solución aplicada por esta migración

| Componente | Acción |
|------------|--------|
| Tabla `consent_history` | Bitácora append-only (solo INSERT) con `organization_id`, `user_id`, `tipo`, `accion`, `version_documento`, IP, UA, metadata. |
| RLS Policy | `consent_history_isolation` — filtra por `organization_id` para aislamiento multi-tenant. |
| FORCE RLS | `ALTER TABLE consent_history FORCE ROW LEVEL SECURITY` para que la policy aplique incluso al owner. |
| Endpoints `datos-personales.js` | 3 endpoints ampliados para registrar en `consent_history` después de cada acción de consentimiento. |

---

## Estructura de la tabla `consent_history`

```sql
CREATE TABLE IF NOT EXISTS consent_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizaciones(id),
  user_id           UUID NOT NULL REFERENCES usuarios(id),
  tipo              TEXT NOT NULL CHECK (tipo IN (
                      'terminos_condiciones',
                      'politica_privacidad',
                      'marketing',
                      'transferencia_internacional',
                      'cookies_analiticas',
                      'cookies_funcionales'
                    )),
  accion            TEXT NOT NULL CHECK (accion IN ('otorgado', 'revocado', 'modificado')),
  version_documento TEXT,
  ip_address        INET,
  user_agent        TEXT,
  motivo_revocacion TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Diferencia conceptual con `consentimientos`

| Tabla | Propósito | Operaciones |
|-------|-----------|-------------|
| `consentimientos` | **Estado vigente** del consentimiento por usuario/tipo (último valor). | INSERT, SELECT (estado actual). |
| `consent_history`  | **Bitácora inmutable** de TODAS las acciones (otorgamiento, revocación, modificación). | INSERT only (append-only). |

Ambas son necesarias para auditoría LPDP.

---

## Endpoints modificados (`legalpro-app/server/routes/datos-personales.js`)

| Endpoint | Acción | Tipo en `consent_history` | Acción en `consent_history` |
|----------|--------|----------------------------|------------------------------|
| `POST /api/mis-datos/oposicion` | Oposición a una finalidad de tratamiento | `marketing` o `transferencia_internacional` (mapeado según `finalidad`) | `revocado` |
| `DELETE /api/mis-datos/consentimiento/:tipo` | Revocación de un consentimiento específico | `terminos_condiciones`, `politica_privacidad`, `marketing` o `transferencia_internacional` | `revocado` |
| `DELETE /api/mis-datos/consentimiento` | Revocación TOTAL de todos los consentimientos | 4 entradas (uno por tipo) | `revocado` |

### Helper añadido: `registrarConsentHistory(req, usuarioId, tipo, accion, version, motivo)`

Esta función se invoca después de cada INSERT en `consentimientos` y:

1. Resuelve `organization_id` (JWT primero, BD como fallback).
2. Mapea el `tipo` de `consentimientos` al `tipo` de `consent_history`:
   - `terminos` → `terminos_condiciones`
   - `privacidad` → `politica_privacidad`
   - `marketing` → `marketing`
   - `transferencia_internacional` → `transferencia_internacional`
   - `oposicion` / `eliminacion` → `politica_privacidad` (cubre la base legal ARCO)
3. Inserta en `consent_history` con `ip_address`, `user_agent` y `motivo_revocacion`.
4. **Si el INSERT falla**, se loguea con `console.warn` pero NO rompe el flujo del usuario (la tabla principal sigue funcionando).

### Mapeo de finalidades de oposición → tipo de documento

```js
const finalidadToHistory = {
  marketing:               { tipo: 'marketing',                    accion: 'revocado' },
  ia_automatizada:         { tipo: 'transferencia_internacional',  accion: 'revocado' },
  cesion_terceros:         { tipo: 'transferencia_internacional',  accion: 'revocado' },
  elaboracion_perfiles:    { tipo: 'marketing',                    accion: 'revocado' },
  tratamiento_estadistico: { tipo: 'marketing',                    accion: 'revocado' },
  todos:                   { tipo: 'transferencia_internacional',  accion: 'revocado' },
};
```

> **Nota**: este mapeo es una interpretación de gobernanza. Las finalidades
> de oposición no se corresponden 1:1 con un documento legal, así que se
> usa el documento cuyo flag se ve más afectado. El `motivo_revocacion`
> conserva la finalidad original para trazabilidad completa.

---

## ⚠️ ANTES DE EJECUTAR

1. **BACKUP COMPLETO** de la base de datos:
   ```bash
   pg_dump -Fc -d legalpro -f backup_antes_lpdp35_$(date +%Y%m%d_%H%M%S).dump
   ```
2. Coordinar con el equipo (downtime de pocos segundos — la migración es CREATE TABLE).
3. Verificar que la tabla `organizaciones` y `usuarios` ya existen (creadas en `init.sql`).
4. Tener acceso como usuario con privilegios para CREATE TABLE.

---

## Cómo ejecutar

### 1. Ejecutar la migración (como usuario con privilegios)

```bash
# Railway / Supabase / RDS / local
psql "$DATABASE_URL_SUPERUSER" \
  -v ON_ERROR_STOP=1 \
  -f tools/migrations/2026-08-01-consent-history.sql
```

> ⚠️ El flag `-v ON_ERROR_STOP=1` detiene la ejecución si alguna sentencia falla.
> Sin él, un error silencioso podría dejar la BD inconsistente.

### 2. Verificar resultado

```bash
# Verificar que la tabla existe
psql "$DATABASE_URL_SUPERUSER" \
  -c "\d consent_history"

# Verificar RLS está habilitado y forzado
psql "$DATABASE_URL_SUPERUSER" \
  -c "SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='consent_history';"
```

**Esperado:**
```
    relname      | relrowsecurity | relforcerowsecurity
-----------------+----------------+--------------------
 consent_history | t              | t
```

### 3. Verificar la policy creada

```bash
psql "$DATABASE_URL_SUPERUSER" \
  -c "SELECT polname, polcmd FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relname = 'consent_history';"
```

**Esperado:**
```
        polname             | polcmd
----------------------------+--------
 consent_history_isolation  | r
```

### 4. Redesplegar backend Node

```bash
cd legalpro-app
railway up  # o el comando de deploy correspondiente
```

### 5. Verificar funcionamiento end-to-end

```bash
# Smoke test multi-tenant (verifica RLS en runtime)
node tools/smoke-production.mjs

# Verificador LPDP
node tools/verifiers/verifier-lpdp.mjs
```

---

## Consultas SQL útiles para auditoría

### 1. Ver historial de un usuario específico

```sql
SELECT created_at, tipo, accion, version_documento, motivo_revocacion,
       ip_address, user_agent
FROM consent_history
WHERE user_id = '00000000-0000-0000-0000-000000000011'  -- Abogado demo
ORDER BY created_at DESC;
```

### 2. Ver todas las revocaciones de los últimos 30 días

```sql
SELECT u.email, ch.tipo, ch.accion, ch.motivo_revocacion, ch.created_at
FROM consent_history ch
JOIN usuarios u ON u.id = ch.user_id
WHERE ch.accion = 'revocado'
  AND ch.created_at >= NOW() - INTERVAL '30 days'
ORDER BY ch.created_at DESC;
```

### 3. Conteo de consentimientos por tipo y acción

```sql
SELECT tipo, accion, COUNT(*) AS total
FROM consent_history
GROUP BY tipo, accion
ORDER BY tipo, accion;
```

### 4. Usuarios que aún no tienen consentimiento registrado en `consent_history`

```sql
-- Útil para identificar gaps de auditoría
SELECT u.id, u.email, u.created_at AS usuario_creado
FROM usuarios u
LEFT JOIN consent_history ch ON ch.user_id = u.id
WHERE ch.id IS NULL
  AND u.eliminado_en IS NULL
  AND u.created_at < NOW() - INTERVAL '1 day';  -- excluirlo del día
```

### 5. Versión del último documento aceptado por usuario

```sql
SELECT DISTINCT ON (user_id, tipo)
  user_id, tipo, version_documento, created_at
FROM consent_history
WHERE accion = 'otorgado'
ORDER BY user_id, tipo, created_at DESC;
```

---

## Después de ejecutar

### 1. Política de retención LPDP

> Aún no hay una política formalizada de retención en `consent_history`.
> Por defecto, los registros persisten indefinidamente. Recomendación:
>
> - **Retención mínima**: 10 años (plazo de prescripción de acciones
>   civiles en Perú — Art. 2001 CC).
> - **Purga**: implementar un job (cron) que anonimice o elimine registros
>   con `created_at < NOW() - 10 years` tras demostrar cumplimiento.

### 2. Monitoreo de la tabla

```sql
-- Tamaño de la tabla (debería crecer ~1 KB por evento)
SELECT pg_size_pretty(pg_total_relation_size('consent_history'));

-- Eventos por día (últimos 7 días)
SELECT DATE(created_at) AS dia, COUNT(*) AS eventos
FROM consent_history
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC;
```

### 3. Próximos pasos sugeridos

| Prioridad | Tarea |
|-----------|-------|
| Alta | Modificar `auth.js` (POST `/register` y DELETE `/cuenta`) para registrar también en `consent_history`. |
| Alta | Decidir `organization_id` en `consent_history`: ¿nullable para permitir registro pre-organización? |
| Media | Implementar `GET /api/mis-datos/historial-consentimientos` para que el usuario pueda descargar su historial (portabilidad ARCO). |
| Media | Job de purga automática según plazo de retención. |
| Baja | Crear utility compartido `utils/consent-history.js` para evitar duplicación entre `datos-personales.js` y `auth.js`. |

---

## ⚠️ Trabajo pendiente identificado

### 1. Endpoints en `auth.js` NO modificados (alcance del FIX actual: `datos-personales.js`)

Por completitud de cumplimiento LPDP Art. 21, también deberían registrar
en `consent_history`:

| Endpoint | Acción | ¿Por qué no se modificó? |
|----------|--------|--------------------------|
| `POST /api/auth/register` | Otorgamiento inicial de términos, privacidad, marketing, transferencia | **El usuario aún no tiene `organization_id`** — la FK `consent_history.organization_id` fallaría. |
| `DELETE /api/auth/cuenta` | Eliminación total de la cuenta (revocación implícita de todos los consentimientos) | **Fuera del alcance del FIX actual** (archivo `datos-personales.js`). El usuario YA tiene `organization_id` aquí, así que es trivial añadir el INSERT. |

### 2. Issue del FK `organization_id` (decisión arquitectónica)

Cuando un usuario se registra, no pertenece a ninguna organización (es
un paso previo). Pero la tabla `consent_history` exige `organization_id`:

```sql
organization_id UUID NOT NULL REFERENCES organizaciones(id),
```

**Opciones:**

| Opción | Pros | Contras |
|--------|------|---------|
| A. `NOT NULL` actual | Datos siempre tenant-scoped; RLS funciona sin excepciones. | No se puede registrar consentimientos pre-organización. |
| B. Hacer `organization_id` nullable | Captura 100% del ciclo de vida del consentimiento. | La RLS policy debe tratar NULL explícitamente; queries más complejas. |
| C. Crear una organización "pendiente" automática al registro | Mantiene NOT NULL. | Engrosa el modelo de datos; complica facturación. |

**Recomendación para una migración futura (LPDP-3.6)**: Opción B con
ajuste de la policy:

```sql
CREATE POLICY consent_history_isolation ON consent_history
  USING (
    organization_id IS NULL  -- consentimiento pre-organización
    OR
    organization_id = current_setting('app.current_org_id')::UUID
  );
```

---

## Compatibilidad con migraciones anteriores

| Archivo | Estado | Acción |
|---------|--------|--------|
| `tools/migrations/2026-08-01-multitenant-hardening.sql` | Roles `legalpro_node`/`legalpro_dotnet` con NOBYPASSRLS | Compatible. La tabla `consent_history` aprovecha estos roles. |
| `tools/migrations/2026-enable-rls.sql` | RLS básico + rol `legalpro_app` (legacy) | Compatible. La nueva tabla `consent_history` se suma al ecosistema. |
| `legalpro-app/server/init.sql` | Bootstrap principal | **Inalterado.** Esta migración NO lo modifica. |

---

## Rollback (plan de contingencia)

```sql
BEGIN;

-- 1. Eliminar policy
DROP POLICY IF EXISTS consent_history_isolation ON consent_history;

-- 2. Eliminar tabla
DROP TABLE IF EXISTS consent_history;

COMMIT;
```

> **Nota**: si ya se han insertado registros de `consent_history`, hacer
> backup antes de eliminarlos:
> ```bash
> pg_dump -Fc -d legalpro -t consent_history -f consent_history_backup.dump
> ```

---

## Referencias

- Ley 29733 — Ley de Protección de Datos Personales (Perú)
- D.S. 016-2024-JUS — Reglamento de la LPDP
- PostgreSQL 15 docs: [Row Security Policies](https://www.postgresql.org/docs/15/ddl-rowsecurity.html)
- LPDP Art. 8 — Principio de Responsabilidad
- LPDP Art. 21 — Revocación del consentimiento
- `legalpro-app/server/init.sql` — bootstrap principal
- `tools/migrations/2026-08-01-multitenant-hardening.sql` — migración previa
- AGENTS.md → agente **gobernanza-chief**: LPDP, ARCO, INDECOPI, SUNAT
- AGENTS.md → agente **auditor-lpdp**: validación Ley 29733
- AGENTS.md → agente **database**: schemas, RLS, multi-tenant
- AGENTS.md → agente **refutador-lpdp**: intentos de pass-through ataques LPDP
