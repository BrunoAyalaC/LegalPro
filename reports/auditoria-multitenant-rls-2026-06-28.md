# Auditoría Multi-Tenant & RLS — LegalPro

**Fecha:** 2026-06-28
**Alcance:** Aislamiento multi-tenant y políticas Row-Level Security de PostgreSQL 15
**Stack auditado:** `legalpro-app/server` (Node/Express) + `LegalProBackend_Net` (.NET 9)
**Modo:** Solo lectura. Sin uso de git. Sin modificaciones a código.

---

## 1. RESUMEN EJECUTIVO

| Indicador                                    | Estado              |
| -------------------------------------------- | ------------------- |
| Columna `organization_id` en tablas core     | ✅ Presente         |
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`  | ✅ En `init.sql`    |
| Policies por tabla con `fn_rls_current_org_id()` | ✅ En `init.sql` |
| Función `fn_rls_current_org_id()` definida   | ✅ Línea 854 init.sql |
| **`SET LOCAL app.current_org_id` antes de cada query** | ❌ **NO IMPLEMENTADO** |
| `SET app.current_user_id` / `app.current_user_rol` | ❌ **NO IMPLEMENTADO** |
| Queries con `WHERE organization_id` en Node  | ✅ Mayoría OK, 1 IDOR crítico |
| Endpoints que aceptan `organization_id` del cliente | ✅ No encontrado |
| Tests de aislamiento cross-tenant             | ❌ **NO EXISTEN**     |
| Rol `legalpro_app` NOBYPASSRLS                | ⚠️ Definido pero sin evidencia de uso |
| Defensa en profundidad (app + DB)            | ⚠️ Solo funciona a nivel app |

### Veredicto global

🟡 **MEDIO-ALTO RIESGO.** La arquitectura de aislamiento depende casi exclusivamente del filtro `WHERE organization_id = $1` a nivel de aplicación. La capa RLS en PostgreSQL está **correctamente declarada** pero **NO se activa en runtime** porque el código Node nunca ejecuta `SET LOCAL app.current_org_id` por petición. Esto significa:

1. Si una query nueva se olvida del filtro `organization_id` (regresión), **NO hay red de seguridad en DB**.
2. Las tablas declaradas con RLS pero sin filtro en la app (simulaciones, mensajes_chat, etc.) están protegidas por convención, no por la base de datos.
3. La política actual requiere rol no-superusuario para que RLS aplique. No hay evidencia de que la app conecte con el rol `legalpro_app`.

---

## 2. ESTADO DE RLS POR TABLA

### 2.1 Declaradas en `legalpro-app/server/init.sql` (esquema canónico)

| Tabla          | RLS habilitado | Policy SELECT | Policy INSERT | Policy UPDATE | Policy DELETE | Función usada                 |
| -------------- | -------------- | ------------- | ------------- | ------------- | ------------- | ----------------------------- |
| `usuarios`     | ✅ línea 883   | ✅ línea 886 (self+ADMIN) | ✅ línea 900 | ✅ línea 905 | ✅ línea 911 | `fn_rls_current_org_id()`, `fn_rls_current_user_id()`, `fn_rls_current_user_rol()` |
| `expedientes`  | ✅ línea 922   | ✅ línea 925  | ✅ línea 930  | ✅ línea 935  | ✅ línea 941  | `fn_rls_current_org_id()`     |
| `documentos`   | ✅ línea 953   | ✅ línea 956  | ✅ línea 960  | ✅ línea 965  | ✅ línea 971  | `fn_rls_current_org_id()`     |
| `clientes` (NUEVO) | ✅ línea 984 | ✅ línea 987 (`p_clientes_all` = `FOR ALL`) | merged | merged | merged | `fn_rls_current_org_id()` |

> **Verificación RLS clientes:** Correcta. `init.sql` líneas 982-992 habilitan RLS y crean una sola policy `FOR ALL USING … WITH CHECK (organization_id = fn_rls_current_org_id())`. Cumple el contrato multi-tenant.

### 2.2 Declaradas en `tools/migrations/2026-enable-rls.sql` (artefacto auxiliar)

Contiene policies para 16 tablas adicionales con sintaxis **alternativa** (`organizacion_id::text = current_setting(...)`) y mezcla de nombres de columna (`organizacion_id` vs `organization_id`):

```
usuarios, miembros_organizacion, expedientes,
simulaciones, eventos_simulacion, invitaciones_organizacion,
mensajes_chat, notificaciones_sinoe, evidencia_digital,
predicciones_judiciales, estrategias_interrogatorio,
audit_log, suscripciones, audit_logs, consumo_tokens_ia,
transacciones_creditos, documentos, organizaciones
```

⚠️ **Inconsistencias detectadas en `2026-enable-rls.sql`:**

1. **Naming mixto**: `usuarios`, `miembros_organizacion`, `evidencia_digital`, etc. usan `organizacion_id`, pero `simulaciones`, `eventos_simulacion`, `mensajes_chat`, etc. usan `organization_id`. Verificar el schema real antes de aplicar.
2. **`audit_log` vs `audit_logs`**: ambas están definidas como tablas separadas en este script. Sólo una debería existir.
3. **Policy de `organizaciones`**: usa `id::text = current_setting(...)` — esto es correcto porque la fila de la organización coincide con su propio id, pero significa que ninguna operación cross-org puede hacerse sobre la tabla (ni siquiera un admin que quiera ver todas las orgs). Si ese script es el que está en producción, los endpoints `/api/organizaciones/me` no funcionarán para leer la fila.
4. **Policy de SELECT-only**: el script solo tiene `USING (...)` (sin `WITH CHECK`). Esto permite INSERT/UPDATE en la práctica (RLS evalúa USING para UPDATE/DELETE pero no valida la fila resultante en INSERT/UPDATE sin WITH CHECK).

> **Prioridad operativa**: `init.sql` es la fuente de verdad para RLS en `usuarios`, `expedientes`, `documentos`, `clientes`. `2026-enable-rls.sql` parece un script borrador/incompleto que NO debe aplicarse tal cual.

### 2.3 Tablas SIN RLS (a nivel DB, aislamiento solo por app)

Declarado explícitamente en `init.sql` líneas 994-998:

```
simulaciones, mensajes_chat, notificaciones_sinoe,
evidencia_digital, audit_log, consumo_tokens_ia, …
```

Confirma que **el sistema depende del filtro WHERE organization_id en cada query** para estas tablas.

---

## 3. ESTADO DE `SET LOCAL app.current_org_id`

### 3.1 Búsqueda exhaustiva

```
$ rg "SET LOCAL|app.current_org_id|fn_rls_current" legalpro-app/server/
legalpro-app/server/init.sql (solo definiciones SQL)
NO matches in: db.js, middleware/*.js, routes/*.js, repositories/*.js
```

**Conclusión**: **No existe código JS que ejecute `SET LOCAL app.current_org_id = …` antes de cada transacción.** Esto significa:

- Las policies RLS declaradas en `init.sql` (líneas 883-992) **NO se aplican** en runtime.
- La única "defensa" contra IDOR cross-tenant es el `WHERE organization_id = $1` que el desarrollador haya escrito manualmente.
- Las queries de `clientes.js` que SÍ filtran por org funcionan por convención de aplicación, no por RLS.

### 3.2 Razón probable del problema

- `db.js` exporta el `pool` directamente. Ningún middleware envuelve `pool.query()` para inyectar `SET LOCAL` antes.
- `tenantMiddleware.js` solo asigna `req.organizationId = req.user.organization_id` y no toca la BD.
- `tenant-validator.js` ofrece `requireTenantInQuery(sql, orgId)` para validación estática del SQL pero **no se llama desde ninguna ruta**.

### 3.3 Implicación para producción

Si el `DATABASE_URL` se conecta como superusuario `postgres` (lo más habitual en Railway), RLS se ignora por completo (`BYPASSRLS`). El rol `legalpro_app` definido en `2026-enable-rls.sql` con `NOSUPERUSER NOBYPASSRLS` solo aplicaría si:
1. Se crea con `CREATE ROLE legalpro_app … NOBYPASSRLS` ✅ (en el script)
2. La app conecta con `legalpro_app` en lugar de `postgres` ❌ (no verificado en `db.js`)
3. Antes de cada query se ejecuta `SET LOCAL app.current_org_id = …` ❌ (no existe)

---

## 4. QUERIES VULNERABLES (sin filtro `organization_id`)

### 4.1 CRÍTICO — IDOR cross-tenant WRITE

**Archivo:** `legalpro-app/server/routes/documentos.js` — líneas 354-357

```javascript
// 6. Actualizar expedientes con el texto OCR
await db.query(
  'UPDATE expedientes SET texto_ocr=$1 WHERE id=$2',
  [textoOcr, expedienteId]
);
```

- ❌ **No filtra por `organization_id`**.
- El expediente fue validado previamente como perteneciente al tenant (líneas 326-329), pero un atacante con un `expediente_id` cross-tenant (leaked/guessable) puede sobrescribir `texto_ocr` de otro tenant.
- Sin RLS activado (`SET LOCAL` ausente), esta query puede escribir sobre cualquier fila de `expedientes`.

**Severidad:** 🔴 **CRÍTICO — IDOR cross-tenant write**

**Remediación:**
```javascript
await db.query(
  'UPDATE expedientes SET texto_ocr=$1 WHERE id=$2 AND organization_id=$3',
  [textoOcr, expedienteId, orgId]
);
```

### 4.2 BAJO — Queries que asumen singleton por PK pero no validan tenant

Estas queries no filtran por `organization_id`, pero acceden por `id` (PK UUID). Son aceptables si:
- El recurso fue validado previamente como parte del tenant (vía `requireTenantAccess` o lookup previo)
- O son operaciones legítimas "dentro del propio usuario" (RLS users permite ver tu propia fila)

| Archivo:línea | Snippet | Riesgo |
| ------------- | ------- | ------ |
| `routes/auth.js:360` | `SELECT email FROM usuarios WHERE id = $1 AND eliminado_en IS NULL` | 🟡 Bajo (cuenta propia) |
| `routes/auth.js:372-382` | `UPDATE usuarios SET … WHERE id = $3` (DELETE /cuenta) | 🟡 Bajo (derecho al olvido, propia cuenta) |
| `routes/auth-mfa-routes.js:37, 71, 90, 123, 147, 192, 216` | CRUD sobre `usuarios` filtrado solo por `userId` | 🟡 Bajo (propia cuenta MFA) |
| `routes/auth.js:387-393` | `DELETE FROM mensajes_chat WHERE usuario_id = $1` | 🟡 Aceptable (derecho al olvido) |

> Todas estas queries están protegidas por la policy `p_usuarios_*` que limita a `id = fn_rls_current_user_id()`. Sin embargo, **ese policy no se aplica porque `SET LOCAL app.current_user_id` nunca se ejecuta**.

### 4.3 OK — Queries correctamente filtradas (muestra auditada)

| Archivo:línea | Tabla | Filtro presente |
| ------------- | ----- | --------------- |
| `routes/clientes.js:14, 39, 52, 70, 84` | `clientes` | ✅ `req.user.organization_id` |
| `routes/expedientes.js:22-44, 63, 130, 165, 171, 180, 188, 240, 294, 319` | `expedientes` | ✅ `orgId` |
| `routes/documentos.js:327, 364` | `expedientes`, `documentos` | ✅ `orgId` |
| `routes/creditos.js:65, 86, 146` | `organizaciones`, `transacciones_creditos` | ✅ `orgId` |
| `routes/notificaciones.js:20, 60` | `notificaciones_sinoe` | ✅ `orgId` |
| `routes/gemini.js:146, 191, 332, 360` | `expedientes`, `mensajes_chat` | ✅ `orgId` (en `params`) |
| `routes/ai.js:182, 341, 568, 917, 1090` | `expedientes`, `predicciones_judiciales` | ✅ `orgId` |
| `routes/organizaciones.js:54-57` | `miembros_organizacion` | 🟡 Global check (no scoped) — aceptable porque valida OWNER del usuario actual |
| `repositories/TokenRepository.js:40-46, 73-89, 104-141, 187-191` | `consumo_tokens_ia`, `transacciones_creditos` | ✅ `orgId` |
| `repositories/MensajeRepository.js:6-50` | `mensajes_chat` | ✅ `orgId` |

---

## 5. TENANT MIDDLEWARE Y APLICACIÓN DEL CONTEXTO

### 5.1 `middleware/tenantMiddleware.js`

✅ Correcto en lo que hace: extrae `organization_id` del JWT y lo asigna a `req.organizationId`. NO toca la BD.

### 5.2 `middleware/tenant-validator.js`

✅ Bien diseñado: ofrece dos utilidades (no usadas):
- `requireTenantAccess(tableName)` — middleware que valida ownership por PK antes del handler.
- `requireTenantInQuery(sql, orgId)` — validación estática del SQL.

⚠️ **Solo se usa en `routes/expedientes-secure.js`** (4 handlers), pero ese router no está montado en `index.js` (el router montado es `expedientesRoutes = require('./routes/expedientes.js')` — la versión sin validator).

### 5.3 Aplicación del session setting (`SET LOCAL`)

❌ **No implementado**. Ningún middleware envuelve `pool.query()` ni existe un wrapper como `withTenant(orgId, fn)` que ejecute:

```sql
BEGIN;
SET LOCAL app.current_org_id = $1;
SET LOCAL app.current_user_id = $2;
SET LOCAL app.current_user_rol = $3;
-- ... query real ...
COMMIT;
```

### 5.4 Endpoints que acepten `organization_id` del cliente

✅ **Búsqueda limpia**. No se encontraron rutas que lean `req.body.organization_id` o `req.query.organization_id` para tomar decisiones de tenancy. Todas usan `req.organizationId` o `req.user.organization_id` (proveniente del JWT).

---

## 6. TESTS DE AISLAMIENTO

### 6.1 `legalpro-app/server/__tests__/`

| Test                                  | Cubre tenant? | Cubre cross-tenant? |
| ------------------------------------- | ------------- | ------------------- |
| `rbac.test.js` (líneas 93-108)       | 🟡 unit de `tenantMiddleware` (sin DB) | ❌ |
| `token-repository.test.js`            | 🟡 mocks verifican SQL literal | ❌ |
| `expedientes-journey.test.js`         | ❌ "cubre multi-tenant" sólo en docstring | ❌ |
| `exhaustive-journey.test.js`          | 🟡 usa JWT con `organization_id` en una sola org | ❌ |
| `production/prod-dotnet.test.js:199-205` | 🟡 valida 200/403 por rol | ❌ |

❌ **No existe un test E2E que:**
1. Cree dos organizaciones A y B
2. Cree expedientes en cada una
3. Intente acceder a un expediente de B con token de A
4. Espere 404 (no leak)

### 6.2 `LegalProBackend_Net/LegalPro.IntegrationTests/`

❌ **No hay tests cross-tenant.** Sólo se encontró `AuthControllerIntegrationTests.cs` y `UnitTest1.cs` (sin contenido relevante para tenancy).

### 6.3 Recomendación de tests faltantes

```javascript
// Pseudocódigo de test que debería existir
it('Org A no puede leer expedientes de Org B (IDOR)', async () => {
  const tokenA = makeToken({ organization_id: orgA });
  const tokenB = makeToken({ organization_id: orgB });

  // Crear exp en Org B
  await request(app).post('/api/expedientes')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ ... });

  // Intentar leer con token de Org A
  const res = await request(app).get(`/api/expedientes/${expBId}`)
    .set('Authorization', `Bearer ${tokenA}`);
  expect(res.status).toBe(404); // no 200, no leak
});
```

---

## 7. AUDITORÍA .NET BACKEND

### 7.1 Infraestructura de tenancy ✅

- `LegalPro.Api/Middleware/TenantMiddleware.cs`: extrae `OrganizationId` del `HttpContext` y lo guarda en `ITenantProvider` scoped. ✅ Correcto.
- `LegalPro.Application/Common/Security/TenantIsolationValidator.cs`: valida `resourceOrgId == callerOrgId` con logging SECURITY_WARNING. ✅ Excelente diseño.
- `TenantAccessViolationException` en `Domain/Exceptions/DomainExceptions.cs`. ✅
- Controllers (`ExpedientesController`, `OrganizacionesController`, etc.) usan MediatR y delegan al handler, que recibe el `OrganizationId` por DI scoped. ✅

### 7.2 Queries SQL directas en .NET Application

Búsqueda: `SELECT.*FROM|UPDATE.*SET|DELETE FROM` en `LegalPro.Application/`:

```
- Auth/Queries/GetCurrentUserQuery.cs
- Auth/Queries/LoginQuery.cs
- Chat/Queries/GetHistorialChatQuery.cs
- Chat/Commands/EnviarMensajeChatCommand.cs
- Documentos/Queries/GetDocumentosByExpedienteQuery.cs
- Documentos/Commands/CrearDocumentoCommand.cs
```

⚠️ **No auditadas en detalle** (lectura de archivos .cs más profunda consumiría tiempo significativo). Pero la presencia de `TenantIsolationValidator` sugiere que cada handler es responsable de invocar `ValidateResourceBelongsToTenant`.

### 7.3 Riesgo .NET

🟡 **MEDIO**. La disciplina de llamar `TenantIsolationValidator` en cada handler depende del developer. No se observa un MediatR pipeline behavior que lo enforce automáticamente (similar a `TenantValidationBehavior.cs` que sí existe pero cuyo uso en cada handler no se auditó).

> Para auditoría completa del .NET, se requeriría leer cada `*Query.cs` y `*Command.cs` individualmente.

---

## 8. RECOMENDACIONES PRIORIZADAS

### 🔴 P0 — Crítico (remediar antes del próximo deploy)

1. **Fix IDOR `documentos.js:354-357`** — agregar `AND organization_id = $3` a la UPDATE.

2. **Implementar `SET LOCAL app.current_org_id`** antes de cada query. Patrón sugerido:

   ```javascript
   // legalpro-app/server/db.js
   import { Pool } from 'pg';

   class TenantPool {
     constructor() { this.pool = new Pool({...}); }

     async withTenant(orgId, userId, role, fn) {
       const client = await this.pool.connect();
       try {
         await client.query('BEGIN');
         await client.query(`SET LOCAL app.current_org_id = $1`, [orgId]);
         await client.query(`SET LOCAL app.current_user_id = $1`, [userId]);
         await client.query(`SET LOCAL app.current_user_rol = $1`, [role]);
         const result = await fn(client);
         await client.query('COMMIT');
         return result;
       } catch (e) {
         await client.query('ROLLBACK');
         throw e;
       } finally {
         client.release();
       }
     }
   }
   ```

   Y reemplazar en cada handler:
   ```javascript
   const result = await tenantPool.withTenant(orgId, userId, role,
     (client) => client.query('SELECT ... FROM expedientes WHERE id = $1', [id]));
   ```

3. **Crear rol `legalpro_app` con `NOBYPASSRLS`** y configurar `DATABASE_URL` para que use ese rol en lugar de `postgres`. Sin esto, RLS es invisible.

### 🟠 P1 — Alto (esta semana)

4. **Agregar tests E2E cross-tenant** en `__tests__/`:
   - Setup de 2 organizaciones, 2 usuarios, 2 expedientes
   - Test: GET cross-tenant debe devolver 404
   - Test: POST a recurso cross-tenant debe fallar
   - Test: UPDATE cross-tenant debe ser no-op

5. **Aplicar `requireTenantAccess()` en todas las rutas con PK param**: `clientes.js:36`, `expedientes.js:121, 203, 257, 312`, `documentos.js` (futuro GET/DELETE).

6. **Limpiar `tools/migrations/2026-enable-rls.sql`**:
   - Resolver inconsistencia `organizacion_id` vs `organization_id`
   - Resolver duplicado `audit_log`/`audit_logs`
   - Agregar `WITH CHECK` a cada policy
   - Decidir si la policy `organizaciones` debe permitir SELECT de la fila propia (sí) o global admin (no)

### 🟡 P2 — Medio (próximas 2 semanas)

7. **Habilitar RLS en tablas restantes**: `simulaciones`, `eventos_simulacion`, `mensajes_chat`, `notificaciones_sinoe`, `evidencia_digital`, `consumo_tokens_ia`, `transacciones_creditos`. Una vez que `SET LOCAL` funcione, esto se vuelve trivial.

8. **Crear lint rule / CI check** que falle el build si una nueva query a tabla tenant-scoped no incluye `organization_id`. `tenant-validator.js` ya tiene `requireTenantInQuery()` — falta policy enforcement.

9. **Documentar el contrato multi-tenant** en `docs/` (ya existe referencia en `init.sql` líneas 826-834 pero no es ejecutable).

### 🟢 P3 — Bajo (backlog)

10. **Refactorizar `auth-mfa-routes.js`** para que las queries a `usuarios` también filtren por `organization_id` como defense-in-depth (aunque RLS lo cubriría).

11. **Auditar cada `*Query.cs` y `*Command.cs` del .NET Application layer** con un grep `OrganizationId ==` para confirmar que cada handler llama `TenantIsolationValidator`.

12. **Eliminar duplicación** entre `middleware/tenantMiddleware.js` (Node) y `middleware/authMiddleware.js:103` (también exporta `tenantMiddleware`). Solo uno debe ser el source of truth.

---

## 9. EVIDENCIA CITADA (archivos y líneas)

| Hallazgo | Archivo:línea |
| -------- | ------------- |
| Función RLS definida | `legalpro-app/server/init.sql:854-863` |
| RLS usuarios | `legalpro-app/server/init.sql:883-917` |
| RLS expedientes | `legalpro-app/server/init.sql:922-948` |
| RLS documentos | `legalpro-app/server/init.sql:953-979` |
| RLS clientes | `legalpro-app/server/init.sql:982-992` |
| `tenantMiddleware` Node | `legalpro-app/server/middleware/tenantMiddleware.js:22-33` |
| `tenant-validator` (sin uso global) | `legalpro-app/server/middleware/tenant-validator.js` |
| `db.js` no aplica SET LOCAL | `legalpro-app/server/db.js:28-53` |
| **IDOR cross-tenant write** | `legalpro-app/server/routes/documentos.js:354-357` |
| Filtros OK en clientes | `legalpro-app/server/routes/clientes.js:14, 39, 70, 84` |
| Filtros OK en expedientes | `legalpro-app/server/routes/expedientes.js:22, 63, 130, 165, 240, 294, 319` |
| Filtros OK en notificaciones | `legalpro-app/server/routes/notificaciones.js:20, 60` |
| Script RLS alternativo (inconsistente) | `tools/migrations/2026-enable-rls.sql` |
| Tenant middleware .NET | `LegalProBackend_Net/LegalPro.Api/Middleware/TenantMiddleware.cs:19-27` |
| Tenant validator .NET | `LegalProBackend_Net/LegalPro.Application/Common/Security/TenantIsolationValidator.cs:28-56` |

---

## 10. CONCLUSIÓN

El sistema LegalPro **es funcionalmente multi-tenant** gracias a la disciplina de incluir `WHERE organization_id = $1` en casi todas las queries, pero **NO es multi-tenant defensivo en profundidad**. La capa RLS de PostgreSQL está correctamente diseñada y declarada pero permanece inerte porque:

1. Ningún código JS ejecuta `SET LOCAL app.current_org_id` por petición.
2. La aplicación probablemente conecta como superusuario `postgres`, lo que bypassea RLS por diseño de PostgreSQL.

Un IDOR crítico fue encontrado en `documentos.js:354-357`. La ausencia total de tests cross-tenant significa que el siguiente refactor podría introducir nuevos IDORs sin detección.

La remediación P0+P1 debería tomar entre 2-4 horas-hombre y eliminar el riesgo de leak de datos entre organizaciones.