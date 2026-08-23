# Migración de Hardening Multi-Tenant (2026-08-01)

> **FIX MT-03** — Garantiza que las políticas RLS sean efectivas en runtime.

## Contexto

### Hallazgo MT-03 (Auditoría Multi-Tenant)

El archivo `legalpro-app/server/init.sql` define las políticas RLS, pero se detectó
que **las policies eran potencialmente inefectivas** porque:

| # | Riesgo detectado | Impacto |
|---|------------------|---------|
| 1 | El rol PostgreSQL usado por ambos backends **no se confirmó** como `NOBYPASSRLS` | Si el rol es `postgres` (owner) o tiene `BYPASSRLS`, **las policies NO aplican**. |
| 2 | Las tablas tienen `ENABLE ROW LEVEL SECURITY` pero **no `FORCE`** | Por defecto, PostgreSQL no aplica RLS al owner de la tabla. |
| 3 | Combinación de ambos | **Filtración cross-tenant latente**: en producción, cualquier conexión con rol `postgres` ve todas las filas de todos los tenants. |

### Solución aplicada por esta migración

| Componente | Acción |
|------------|--------|
| Rol `legalpro_node` | `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOLOGIN` |
| Rol `legalpro_dotnet` | Idéntico al anterior (separación de concerns) |
| Permisos | `GRANT SELECT, INSERT, UPDATE, DELETE` sobre `schema public` |
| FORCE RLS | `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` en 19 tablas tenant |
| Verificación | Query que lista `relrowsecurity` + `relforcerowsecurity` para auditoría |

---

## Tablas afectadas (19 tablas)

| Categoría | Tablas |
|-----------|--------|
| **Core multi-tenant** | `usuarios`, `organizaciones`, `miembros_organizacion` |
| **Expedientes y docs** | `expedientes`, `documentos`, `evidencia_digital`, `clientes` |
| **Simulador** | `simulaciones`, `eventos_simulacion` |
| **IA y Comunicación** | `mensajes_chat`, `notificaciones_sinoe`, `consumo_tokens_ia` |
| **Billing** | `transacciones_creditos`, `invitaciones_organizacion` |
| **Sesión y cumplimiento** | `refresh_tokens`, `consentimientos`, `base_legal_vectorial` |
| **Auditoría y eventos** | `audit_log`, `outbox_messages` |

> **Nota sobre `evidencia_digital`:** El schema canónico `catalogs/supabase-schema.md`
> la llama `evidencia`, pero `init.sql` la define como `evidencia_digital`. Esta
> migración usa el nombre real del bootstrap.

---

## ⚠️ ANTES DE EJECUTAR

1. **BACKUP COMPLETO** de la base de datos:
   ```bash
   pg_dump -Fc -d legalpro -f backup_antes_mt03_$(date +%Y%m%d_%H%M%S).dump
   ```
2. Coordinar con el equipo (downtime breve de ~1 minuto).
3. Tener acceso como superusuario (`postgres` o equivalente con `CREATEROLE`).
4. Verificar versión de PostgreSQL ≥ 13 (requerido para `FORCE ROW LEVEL SECURITY`).
5. **Avisar al equipo backend** que las credenciales de BD van a cambiar.

---

## Cómo ejecutar

### 1. Ejecutar la migración (como superusuario)

```bash
# Railway / Supabase / RDS / local
psql "$DATABASE_URL_SUPERUSER" \
  -v ON_ERROR_STOP=1 \
  -f tools/migrations/2026-08-01-multitenant-hardening.sql
```

> ⚠️ El flag `-v ON_ERROR_STOP=1` detiene la ejecución si alguna sentencia falla.
> Sin él, un error silencioso podría dejar la BD en estado inconsistente.

### 2. Crear passwords para los nuevos roles (ejecutar DESPUÉS)

```bash
psql "$DATABASE_URL_SUPERUSER" <<SQL
ALTER ROLE legalpro_node   WITH LOGIN PASSWORD '<GENERAR_PASSWORD_NODE>';
ALTER ROLE legalpro_dotnet WITH LOGIN PASSWORD '<GENERAR_PASSWORD_DOTNET>';
SQL
```

> **Recomendación:** Usar un secret manager (Railway Secrets, AWS Secrets Manager,
> Doppler, etc.). Nunca commitear passwords al repositorio.

### 3. Verificar resultado

```bash
# Verificar roles creados
psql "$DATABASE_URL_SUPERUSER" \
  -c "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
      WHERE rolname IN ('legalpro_node', 'legalpro_dotnet', 'legalpro_app');"

# Esperado:
#   rolname         | rolsuper | rolbypassrls
#  -----------------+----------+--------------
#   legalpro_node   | f        | f
#   legalpro_dotnet | f        | f
```

```bash
# Verificar FORCE RLS en tablas tenant (deben ser 19 filas con rls_forzada = t)
psql "$DATABASE_URL_SUPERUSER" \
  -c "SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND relrowsecurity = true
      ORDER BY relname;"
```

---

## Después de ejecutar

### 1. Actualizar credenciales en ambos backends

#### Backend Node (`legalpro-app/server/.env`)
```env
DATABASE_URL=postgresql://legalpro_node:<PASSWORD>@host:port/legalpro
```

#### Backend .NET (`LegalProBackend_Net/appsettings.json` + Railway env)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=...;Username=legalpro_dotnet;Password=<PASSWORD>;Database=legalpro"
  }
}
```

### 2. Redesplegar backend Node y .NET

```bash
# Node
cd legalpro-app/server && railway up

# .NET
cd LegalProBackend_Net && railway up
```

### 3. Verificar que las conexiones funcionan

```bash
# Backend Node debe responder sin errores de permisos
curl https://<backend-node>/health

# Backend .NET debe responder sin errores de permisos
curl https://<backend-dotnet>/health
```

### 4. Smoke test cross-tenant

```bash
node tools/smoke-production.mjs
```

### 5. Ejecutar los verificadores de seguridad

```bash
# 22 verificadores de seguridad
node tools/security/run-all.mjs

# Verificador multi-tenant específico
node tools/security/verifier-multi-tenant.mjs

# Verificador RLS
node tools/security/verifier-rls.mjs
```

---

## Rollback (plan de contingencia)

Si algo falla, restaurar el backup es la vía más rápida:

```bash
# Restaurar backup completo
dropdb legalpro
createdb legalpro
pg_restore -d legalpro backup_antes_mt03_*.dump
```

Si no hay backup, revertir manualmente:

```sql
BEGIN;

-- 1. Revertir FORCE RLS (mantener ENABLE por seguridad)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname='public'
      AND tablename IN ('usuarios','expedientes','documentos',
        'evidencia_digital','clientes','simulaciones','eventos_simulacion',
        'mensajes_chat','notificaciones_sinoe','audit_log','consumo_tokens_ia',
        'transacciones_creditos','invitaciones_organizacion',
        'miembros_organizacion','organizaciones','refresh_tokens',
        'consentimientos','base_legal_vectorial','outbox_messages')
  LOOP
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- 2. Devolver permisos a las conexiones existentes (NO elimina los roles)
-- Los roles quedan intactos; el backend sigue funcionando con postgres.

COMMIT;
```

> **Nota:** Eliminar los roles (`DROP ROLE`) puede romper conexiones activas.
> Solo hacerlo tras confirmar que ninguna app los está usando.

---

## Compatibilidad con migraciones anteriores

| Archivo | Estado | Acción |
|---------|--------|--------|
| `tools/migrations/2026-enable-rls.sql` | Define `legalpro_app` (rol legacy) | **Se mantiene como fallback.** Esta migración añade `legalpro_node` y `legalpro_dotnet`. |
| `legalpro-app/server/init.sql` | Bootstrap con RLS policies | **Inalterado.** Esta migración NO toca policies ni datos, solo metadatos (roles + FORCE). |

---

## Próximos pasos sugeridos (post-MT-03)

1. **Eliminar `legalpro_app`** (rol legacy) una vez validado que ambos backends usan los nuevos roles.
2. **Crear tests automatizados** que validen el aislamiento multi-tenant en CI.
3. **Documentar** en `docs/runbooks/database.md` cómo rotar los passwords de estos roles.
4. **Migrar** `legalpro-app/server/init.sql` para usar el rol `legalpro_node` en seeds (si aplica).

---

## Referencias

- PostgreSQL 15 docs: [ROW LEVEL SECURITY](https://www.postgresql.org/docs/15/ddl-rowsecurity.html)
- OWASP: [Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- `catalogs/supabase-schema.md` — schema canónico del proyecto
- `legalpro-app/server/init.sql` — bootstrap real (no canónico)
- `tools/migrations/2026-enable-rls.sql` — migración previa (RLS defense-in-depth)
- AGENTS.md → agente **database**: schema, RLS, multi-tenant, auditoría
- AGENTS.md → agente **auditor-multi-tenant**: detección de IgnoreQueryFilters, IDOR
