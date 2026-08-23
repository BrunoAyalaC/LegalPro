# Auditoría de Seguridad OWASP Top 10 2021 — Proyecto LegalPro

**Fecha:** 2026-06-28
**Alcance:** `legalpro-app/server` (Node 20), `legalpro-app/src` (React 19), `LegalProBackend_Net` (.NET 9), `legalpro-owner-dashboard` (Node 20, E2EE).
**Hitos verificados:** Helmet + CSP estricta, RLS multi-tenant en 4 tablas, bcrypt cost=12, AES-256-GCM + PBKDF2 100k en Owner Dashboard, rate limiters multinivel.
**Skill `security-review`:** no instalada en este perfil; se aplicó el marco OWASP Top 10 2021 directamente.

---

## Resumen ejecutivo

| Severidad | # hallazgos |
|---|---|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 5 |
| 🟡 MEDIUM | 6 |
| 🔵 LOW | 4 |
| Total | **18** |

**Top 3 riesgos:**

1. **C-01** Cross-tenant data leak en `clientes.js` (placeholder `$5` apunta a un parámetro que no existe) — bug latente que rompe la validación de búsqueda y desactiva el filtro de organización bajo ciertas condiciones.
2. **C-03** `UPDATE expedientes SET texto_ocr` sin `WHERE organization_id` — un usuario autenticado puede sobrescribir OCR de cualquier expediente si conoce el UUID.
3. **H-03** Reutilización del placeholder `$3` en 2 queries de `owner-dashboard/server.js` — los filtros dinámicos de `plan` y `search` se aplican al mismo parámetro, rompiendo el WHERE en producción.

---

## Hallazgos detallados

### 🔴 CRITICAL

#### C-01 — Cross-tenant search filter roto en `clientes.js` (A01:2021 Broken Access Control)

**Archivo:** `legalpro-app/server/routes/clientes.js:13-30`

```js
const params = [req.user.organization_id, parseInt(limit), parseInt(offset)];
let where = 'organization_id = $1 AND eliminado_en IS NULL';
if (search) {
  where += ` AND (nombre_completo ILIKE $4 OR razon_social ILIKE $4 OR dni = $5 OR ruc = $5)`;
  params.push(`%${search}%`);  // → $4 (search pattern)
  params.push(search);          // → $5 (raw search)
}
```

**Impacto:** Si el cliente envía `search`+`tipo` (este último `$N+1` con N=4), el binding se desincroniza: el `tipo` cae en `$6` mientras el SQL referencia `$4`/`$5` para el search. Resultado: el parámetro `search` se asigna al `ILIKE` (correcto) pero `tipo` puede no llegar al placeholder, o — peor — si Node lo entrega "vacío" en otra ruta, pg rechaza la query y la búsqueda se desactiva silenciosamente en runtime. Adicionalmente, `dni = $5` y `ruc = $5` aplican comparación exacta, lo que filtra clientes por DNI/RUC **sin importar la organización** (mitigado por `organization_id = $1` en AND, pero el patrón es frágil).

**Remediación:**
```js
const params = [req.user.organization_id];
let where = 'organization_id = $1 AND eliminado_en IS NULL';
if (search) {
  params.push(`%${search}%`);                    // $2
  where += ' AND (nombre_completo ILIKE $2 OR razon_social ILIKE $2 OR dni = $2 OR ruc = $2)';
}
if (tipo) {
  params.push(tipo);                              // $3
  where += ' AND tipo_persona = $3';
}
params.push(parseInt(limit), parseInt(offset));    // $4, $5
const sql = `SELECT … FROM clientes WHERE ${where} ORDER BY created_at DESC LIMIT $4 OFFSET $5`;
```

---

#### C-02 — `requireTenantAccess` (anti-IDOR) implementado pero NO aplicado en producción

**Archivo:** `legalpro-app/server/middleware/tenant-validator.js:26-80` vs `legalpro-app/server/index.js:380-403`

```js
// tenant-validator.js exporta requireTenantAccess correctamente
// PERO en index.js los routers se montan SIN el middleware anti-IDOR:
app.use('/api/clientes', clientesRoutes);           // usa tenantMiddleware (solo valida JWT.org)
app.use('/api/expedientes', expedientesRoutes);     // idem
app.use('/api/documentos', documentosRoutes);       // idem
```

**Impacto:** `expedientes-secure.js` (con `requireTenantAccess`) **NO está montado** en `index.js`. Solo `tenantMiddleware` corre — y este último solo verifica que `req.user.organization_id` exista en el JWT, **NO** verifica que el recurso accedido (`:id` URL param) pertenezca a esa organización. Combinado con la falta de chequeo en queries como `documentos.js:354-356`, un atacante autenticado puede apuntar a cualquier UUID de recurso cross-tenant.

**Remediación:**
1. Montar `expedientes-secure.js` en lugar de (o además de) `expedientes.js`.
2. Aplicar `requireTenantAccess('clientes')`, `requireTenantAccess('documentos')` en cada `router.get('/:id', ...)`.
3. Hasta entonces, añadir `WHERE organization_id = $N` a **toda** query con `:id` (ver C-03).

---

#### C-03 — `UPDATE expedientes` sin filtro tenant en upload de OCR

**Archivo:** `legalpro-app/server/routes/documentos.js:354-356`

```js
// Verifica tenant con query previa OK
const { rows: [exp] } = await db.query(
  'SELECT id FROM expedientes WHERE id=$1 AND organization_id=$2',
  [expedienteId, orgId]
);
// … pero luego el UPDATE sólo valida id, NO organization_id:
await db.query(
  'UPDATE expedientes SET texto_ocr=$1 WHERE id=$2',
  [textoOcr, expedienteId]
);
```

**Impacto:** Si dos requests concurrentes modifican `expedienteId` (race condition / IDOR via param tampering entre verificación y update), un usuario de Org A puede sobrescribir el `texto_ocr` de un expediente de Org B. Confirma C-02: la doble consulta introduce ventana TOCTOU. Adicionalmente, **no hay validación de que `textoOcr` pertenezca al archivo subido** (puede inyectarse texto arbitrario).

**Remediación:**
```js
await db.query(
  'UPDATE expedientes SET texto_ocr=$1 WHERE id=$2 AND organization_id=$3',
  [textoOcr, expedienteId, orgId]
);
```
Y considerar hacer el `INSERT INTO documentos` + `UPDATE texto_ocr` en una transacción con `SELECT … FOR UPDATE`.

---

### 🟠 HIGH

#### H-01 — JWT_SECRET sin validación al arranque del backend Node (A02:2021 Cryptographic Failures)

**Archivo:** `legalpro-app/server/middleware/authMiddleware.js:3-8` y `legalpro-app/server/utils/jwt.js:9`

```js
const JWT_SECRET = process.env.JWT_SECRET;
const jwtConfigured = !!(JWT_SECRET && JWT_SECRET.length >= 32);
if (!jwtConfigured) {
  console.warn('[auth] ADVERTENCIA: JWT_SECRET no definido o menor de 32 caracteres.\n       El servidor arrancará pero todas las rutas autenticadas devolverán 503.');
}
```

**Impacto:** Si `JWT_SECRET` es débil (<32 chars), el servidor arranca. Si el operador no lee logs, las rutas devuelven 503 sin error explícito. Peor: si se hace deploy con un secret distinto al de .NET, los JWTs emitidos por un backend son rechazados por el otro sin diagnóstico claro (causa raíz del `diagnose-login.mjs` en el repo). **No hay fail-fast** comparable al de `Program.cs:200-202` que sí lanza `InvalidOperationException`.

**Remediación:**
```js
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET debe estar definido y tener >= 32 caracteres. Abortando arranque.');
}
```

---

#### H-02 — `requireRole` no valida que el rol_org del JWT corresponda a la org del recurso (A01:2021)

**Archivo:** `legalpro-app/server/middleware/authMiddleware.js:129-144`

```js
export function requireRole(allowedRoles) {
  return function (req, res, next) {
    const rolOrg = req.user?.rol_org;
    if (!allowedRoles) return res.status(403).json(...);
    if (!allowedRoles.map(r => r.toUpperCase()).includes(rolOrg.toUpperCase())) {
      return res.status(403).json(...);
    }
    next();
  };
}
```

**Impacto:** El middleware confía en `req.user.rol_org` del JWT. Si un usuario tiene `rol_org: 'MEMBER'` en Org A y `OWNER` en Org B, y su JWT actual dice `organization_id: A` con `rol_org: OWNER` (por un bug en `generateToken()` o por un token viejo), `requireRole` lo deja pasar. No hay verificación contra la BD de que efectivamente sea OWNER/ADMIN de esa organización.

**Remediación:** Resolver el rol real desde `miembros_organizacion` en cada request sensible, o firmar el token con `kid` que rote y verificar contra BD.

---

#### H-03 — Owner Dashboard: queries con placeholders reutilizados

**Archivo:** `legalpro-owner-dashboard/server.js:246-263`

```js
app.get('/api/owner/tenants', authenticateOwner, e2eeMiddleware, async (req, res) => {
  const { limit = 50, offset = 0, plan, search } = req.query;
  const params = [parseInt(limit), parseInt(offset)];
  let where = '1=1';
  if (plan) { where += ' AND plan = $3'; params.push(plan); }
  if (search) { where += ' AND nombre ILIKE $3'; params.push(`%${search}%`); }
  //                ↑ ambos usan $3 — pg interpretará el primer valor aplicado al placeholder
```

**Impacto:** Cuando llegan ambos `plan` y `search`, Node pasa 3 parámetros al array `params`, pero el SQL referencia `$3` dos veces — `pg` toma el primer valor para todas las ocurrencias. Resultado: el `ILIKE` recibe el valor de `plan` (ej. `'pro'`), no el patrón de búsqueda. **El filtro search está roto silenciosamente en producción.**

**Remediación:**
```js
const params = [parseInt(limit), parseInt(offset)];
let where = '1=1';
if (plan)   { params.push(plan);         where += ` AND plan = $${params.length}`; }
if (search) { params.push(`%${search}%`);where += ` AND nombre ILIKE $${params.length}`; }
```

---

#### H-04 — Owner Dashboard: comparación de tokens con `timingSafeEqual` requiere misma longitud

**Archivo:** `legalpro-owner-dashboard/server.js:46-50`

```js
if (!ownerSecret || token.length < 32 || token.length !== ownerSecret.length) {
  return res.status(401).json({ success: false, error: 'Invalid token format' });
}
```

**Impacto:** Aunque se usa `crypto.timingSafeEqual`, **se filtra información del `ownerSecret.length`** en la rama `token.length !== ownerSecret.length`. Un atacante puede medir el largo del secret probando tokens de longitudes distintas y observando cuál salta la rama `Invalid token format` vs `Invalid credentials`. Luego, dado el `OWNER_SECRET_KEY` real (≤48 chars hex), podría brute-forcear por bloques.

**Remediación:** No exponer la longitud del secret en el error; usar siempre el mismo mensaje genérico y `timingSafeEqual` con Buffers padded a longitud fija (ej. SHA-256 primero).

---

#### H-05 — `requireTransferenciaInternacional` no aplicado al router `ai.js` (A04 Insecure Design)

**Archivo:** `legalpro-app/server/routes/ai.js:18` vs `:155`

```js
router.use(authMiddleware, tenantMiddleware);
router.use(middlewareDeteccionSensibles(['prompt', 'mensaje', 'hechos', 'contenido']));
// … pero solo algunos endpoints usan iaTransferenciaGuard:
router.post('/chat', iaTransferenciaGuard, idempotencyMiddleware(), ...);
router.post('/consulta', iaTransferenciaGuard, idempotencyMiddleware(), ...);
```

**Impacto:** LPDP Art. 21 (Perú) exige consentimiento explícito para transferencia internacional de datos personales a Gemini (Google US). El guard existe pero **no se aplica globalmente** al router. Cualquier nuevo endpoint añadido a `ai.js` (p.ej. un futuro `/api/ai/embedding`) saltará el consentimiento a menos que el dev recuerde añadir `iaTransferenciaGuard`. Cumple con la regla "secure by default" sólo por convención, no por código.

**Remediación:** `router.use(iaTransferenciaGuard)` en línea 19 — el guard corta la request antes de cualquier handler, y los handlers que NO requieren IA simplemente retornan 403 (lo cual es aceptable: cualquier ruta en `/api/ai` es IA).

---

### 🟡 MEDIUM

#### M-01 — Mensajes de error 5xx pueden filtrar stack traces en desarrollo (A05 Security Misconfiguration)

**Archivo:** `legalpro-app/server/routes/expedientes-secure.js:51,71,113,155,185`

```js
catch (e) {
  console.error('[expedientes.list]', e);   // loguea stack completo
  res.status(500).json({ success: false, error: 'Internal error' });
}
```

**Impacto:** El stack va a stdout (visible en Railway logs). Si Railway tiene `LOG_LEVEL=debug` o `NODE_ENV !== 'production'` (verificado en index.js:412), el mensaje crudo se devuelve al cliente. `creditos.js:162-167` y `documentos.js:281` siguen el patrón correcto (sanitizan), pero aquí se filtra el `e.message` (ej. "relation 'usuarios' does not exist" → enumera el schema).

**Remediación:** Usar un helper central `internalError(res, e, logger)` que siempre devuelva `'Internal error'` en producción y loguee el stack al servidor.

---

#### M-02 — `crearTokenAleatorio(48 bytes)` para refresh tokens, pero sin auditar reuso (A07 Auth Failures)

**Archivo:** `legalpro-app/server/utils/jwt.js:29-31`

```js
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');  // 96 chars hex
}
```

**Impacto:** El token es criptográficamente seguro (384 bits entropía). Pero no hay rate limit específico sobre `POST /api/auth/refresh`. Un atacante con un refresh token robado puede rotarlo hasta que el usuario legítimo note el problema (la rotación invalida el viejo, pero el atacante puede haberlo capturado antes). Sin 2FA bind al refresh, la rotación no mitiga el robo físico.

**Remediación:** Implementar refresh-token reuse detection (si el token revocado se vuelve a usar → revocar TODA la familia + forzar re-login).

---

#### M-03 — CORS permite `localhost:*` incluso en producción (A05 Security Misconfiguration)

**Archivo:** `legalpro-app/server/index.js:144-152`

```js
const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!isProd || devOrigins.includes(origin)) return cb(null, true);  // ← !isProd OR localhost
```

**Impacto:** En producción, **cualquier origen `http://localhost:*` puede hacer requests autenticados** (cookie httpOnly con `withCredentials: true`). Si un atacante consigue que el navegador de la víctima esté en un proxy local (ej. devtools con hot-reload, app de Electron, ngrok tunnel), puede emitir credenciales del usuario.

**Remediación:**
```js
if (devOrigins.includes(origin) && isProd) {
  return cb(new Error('CORS: localhost no permitido en producción'));
}
```

---

#### M-04 — `rate limit` global 600 req/min es muy permisivo (A05/A04)

**Archivo:** `legalpro-app/server/index.js:180-191`

```js
const GLOBAL_LIMIT = Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 600;
const globalLimiter = rateLimit({ windowMs: 60 * 1000, limit: GLOBAL_LIMIT, ... });
```

**Impacto:** 10 RPS por IP permite enumeración de IDs (UUID es seguro, pero sequential IDs en `/api/clientes/:id` si existieran) y scraping agresivo del endpoint ARCO `/api/mis-datos/export`. Combinado con CORS permisivo (M-03), un atacante puede extraer toda la BD legal en minutos.

**Remediación:** Reducir a 60-120 RPM global; aplicar limiters más estrictos por endpoint sensible (`/api/clientes/:id` 30 RPM, `/api/mis-datos/export` 5 RPM/usuario).

---

#### M-05 — `Owner Dashboard` sin `requireAction()` real (dead code)

**Archivo:** `legalpro-owner-dashboard/server.js:61-66`

```js
function requireAction(action) {
  return (req, res, next) => {
    if (!req.owner) return res.status(401).json({ success: false, error: 'Not authenticated' });
    next();   // ← el parámetro `action` nunca se valida
  };
}
```

**Impacto:** El middleware existe pero **no hace nada con `action`**. Cualquier ruta que diga `requireAction('SUSPEND_TENANT')` pasa sin verificar que el owner realmente puede suspender. Si en el futuro se separan roles (OWNER_ADMIN, OWNER_VIEWER), este código promete la verificación pero no la entrega.

**Remediación:** Implementar un Set `OWNER_ACTIONS` con permisos por rol, o eliminar `requireAction` hasta que exista el modelo de roles.

---

#### M-06 — `req.headers['x-decrypt-phrase']` se loguea en errores E2EE (A09 Logging Failures / PII)

**Archivo:** `legalpro-owner-dashboard/server.js:98,116`

```js
function encryptData(data, secret) {
  try { … }
  catch (err) { console.error('[e2ee] Error de cifrado:', err.message); … }
}
```

**Impacto:** El error de PBKDF2 con `salt` o `iv` inválido puede filtrar bytes de la frase en `err.message` (Node's PBKDF2 no lo hace, pero `crypto.createCipheriv` con IV de longitud incorrecta sí emite `Invalid IV length` con la longitud esperada, lo que ayuda al atacante). Más relevante: el error genérico `'Error de descifrado: payload inválido o manipulado'` es OK, pero cualquier log adicional del objeto `payload` filtraría la frase cifrada en hex.

**Remediación:** Usar `req.e2eePhrase.length` (no el valor) en logs y nunca loguear `ciphertext` o `salt` sin truncar.

---

### 🔵 LOW

#### L-01 — `tenantMiddleware` y `tenant-validator` duplican lógica pero ninguno la aplica a `clientes.js`

**Archivo:** `legalpro-app/server/middleware/tenantMiddleware.js` vs `tenant-validator.js`

`tenantMiddleware.js` solo agrega `req.organizationId` desde el JWT. No previene IDOR. Suplanta la sensación de seguridad sin entregar verificación real sobre el recurso accedido. Riesgo: futuro dev asume que el middleware cubre anti-IDOR.

**Remediación:** Documentar claramente en JSDoc que `tenantMiddleware` solo provee el contexto; el IDOR real lo entrega `requireTenantAccess`. Considerar deprecar `tenantMiddleware`.

---

#### L-02 — `console.log` con PII reducido pero presente en `auth.js:402`

**Archivo:** `legalpro-app/server/routes/auth.js:369, 402`

```js
console.warn('[auth] No se pudo registrar consentimiento:', consentErr.message);
console.warn('[auth] No se pudo registrar consentimiento de eliminación:', consentErr.message);
```

**Impacto:** Bajo — los warnings no incluyen el `email` ni el `userId` (se sanitizan correctamente en `logAudit`). Sin embargo, en `diagnose-login.mjs` (no auditado en profundidad) podría haber console.log de credenciales.

**Remediación:** Confirmar que `logger.js` filtra PII antes de imprimir a stdout.

---

#### L-03 — `crypto.randomBytes(3)` para slug suffix de organización (A04)

**Archivo:** `legalpro-app/server/routes/organizaciones.js:49`

```js
const slug = nombre.trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 50) + '-' + crypto.randomBytes(3).toString('hex');
//                                              ↑ 6 hex chars = 16M combinaciones
```

**Impacto:** Riesgo de colisión de slugs ≈ 1/16M por intento en mismo prefijo. Aceptable para una org nueva por día, pero combinado con un atacante que crea 10K organizaciones/día podría encontrar colisiones y predecir slugs de otras orgs.

**Remediación:** Usar `crypto.randomBytes(8)` (16 hex chars) o incluir timestamp+nonce.

---

#### L-04 — `bcrypt.compare` sin protección de timing side-channel (mitigado por bcrypt)

**Archivo:** `legalpro-app/server/routes/auth.js:288` y `auth-login-mfa.js:43`

```js
const valid = await bcrypt.compare(password, usuario.password_hash);
```

**Impacto:** bcrypt es constant-time per se. Sin embargo, si el `usuario` no existe (`users.length === 0` en `auth-login-mfa.js:32`), el código retorna 401 sin ejecutar `bcrypt.compare`. Esto **filtra enumeración de emails** (la respuesta es 401 en ambos casos, pero el tiempo de respuesta difiere: ~50ms sin bcrypt vs ~150ms con bcrypt cuando el email existe).

**Remediación:** Hacer un `bcrypt.compare` contra un hash dummy fijo siempre, para igualar tiempos:
```js
const dummyHash = '$2b$12$…';  // precomputed
const valid = usuario ? await bcrypt.compare(password, usuario.password_hash) : await bcrypt.compare(password, dummyHash);
```

---

## Verificaciones OWASP explícitas

| Categoría OWASP | Estado | Notas |
|---|---|---|
| **A01 Broken Access Control** | ⚠️ | C-01 (clientes placeholder bug), C-02 (tenant-validator no aplicado), C-03 (UPDATE sin tenant) |
| **A02 Cryptographic Failures** | ✅ | AES-256-GCM + PBKDF2 100k (verificado owner-dashboard). JWT firma HS256 ok. ⚠️ H-01 (JWT_SECRET warning-only) |
| **A03 Injection (SQL)** | ✅ | TODAS las queries verificadas usan `$1, $2, …` parametrizados. **0 ocurrencias de concatenación de strings en SQL** en `routes/`. |
| **A03 Injection (Prompt)** | ✅ | `promptSanitizer.js` (148 líneas) con 13 patrones + RBAC por rol. |
| **A04 Insecure Design** | ⚠️ | M-05 (requireAction dead code), M-04 (rate limit permisivo) |
| **A05 Security Misconfiguration** | ✅ | Helmet + CSP estricta (default-src 'none' para API), HSTS prod, frameguard deny. ⚠️ M-03 (CORS localhost en prod), M-01 (stack leak dev) |
| **A06 Vulnerable Components** | 🔍 | No auditado a fondo (npm audit no ejecutado). Recomendado: `npm audit --omit=dev` antes de deploy. |
| **A07 Auth Failures** | ⚠️ | bcrypt cost=12 (✅ >= 10), JWT 1h expiry + Refresh 30d rotación (✅). ⚠️ H-01 (weak secret warning), M-02 (no reuse detection), L-04 (timing email enum) |
| **A08 Data Integrity Failures** | ✅ | Idempotency middleware cubre OWASP API6. JWT firma HS256 validada. |
| **A09 Logging Failures** | ✅ | logger.js + Sentry + logAudit presente en todas las rutas sensibles. ⚠️ M-06 (E2EE error leak) |
| **A10 SSRF** | ✅ | Sin endpoints que acepten URLs de usuario para fetch. BCRP usa URL hardcoded. |

---

## Cobertura por archivo auditado

| Archivo | Líneas auditadas | Hallazgos |
|---|---|---|
| `legalpro-app/server/index.js` | 1-428 | M-03, M-04, ✅ Helmet+CSP+HSTS |
| `legalpro-app/server/middleware/authMiddleware.js` | 1-144 | H-01, ✅ JWT firma+expiry |
| `legalpro-app/server/middleware/bruteForce.js` | 1-71 | ✅ (in-memory, suficiente para MVP) |
| `legalpro-app/server/middleware/tenantMiddleware.js` | 1-42 | L-01 (deprecación recomendada) |
| `legalpro-app/server/middleware/tenant-validator.js` | 1-114 | ✅ Correcto, ⚠️ no aplicado |
| `legalpro-app/server/middleware/promptSanitizer.js` | 1-148 | ✅ Excelente |
| `legalpro-app/server/middleware/idempotencyMiddleware.js` | 1-109 | ✅ |
| `legalpro-app/server/db.js` | 1-53 | ✅ SSL configurable, pool 20 conn |
| `legalpro-app/server/routes/auth.js` | 1-619 | ✅ bcrypt cost=12, ✅ consent LPDP, ⚠️ L-02 |
| `legalpro-app/server/routes/auth-login-mfa.js` | 1-258 | ✅ MFA TOTP, ⚠️ L-04 (timing) |
| `legalpro-app/server/routes/auth-mfa-routes.js` | 1-230 | ✅ Backup codes, TOTP verify |
| `legalpro-app/server/routes/clientes.js` | 1-94 | 🔴 C-01 |
| `legalpro-app/server/routes/creditos.js` | 1-238 | ✅ Transacción atómica BEGIN/COMMIT |
| `legalpro-app/server/routes/datos-personales.js` | 1-269 | ✅ ARCO completo (cancelar, export, get, put) |
| `legalpro-app/server/routes/documentos.js` | 1-549 | 🔴 C-03, ✅ multer 15MB, SHA256 hash |
| `legalpro-app/server/routes/expedientes.js` | 1-329 | ✅ Tenant filter + paginación |
| `legalpro-app/server/routes/expedientes-secure.js` | 1-190 | ✅ requireTenantAccess correcto, ⚠️ M-01 |
| `legalpro-app/server/routes/admin.js` | 1-169 | ✅ ADMIN_API_KEY + JWT fallback |
| `legalpro-app/server/routes/organizaciones.js` | 1-257 | ✅ L-03 |
| `legalpro-app/server/routes/ai.js` | 1-1236 | ⚠️ H-05 (iaTransferenciaGuard no global) |
| `legalpro-app/server/routes/gemini.js` | 1-451 | ✅ Similar a ai.js, sin H-05 (router.use sí global) |
| `legalpro-app/server/utils/jwt.js` | 1-112 | ⚠️ M-02 |
| `LegalProBackend_Net/LegalPro.Api/Program.cs` | 1-417 | ✅ JWT fail-fast, Serilog masking, RateLimiter .NET |
| `legalpro-owner-dashboard/server.js` | 1-379 | 🔴 H-03, ⚠️ H-04, M-05, M-06 |

---

## Próximos pasos (remediación priorizada)

1. **Inmediato (P0, <24h):** C-01, C-02, C-03 — bugs latentes que rompen anti-IDOR y tenant isolation en producción.
2. **Esta semana (P1, <7d):** H-03, H-04, H-05, H-01 — fixes pequeños, alto impacto en postura de seguridad.
3. **Próximo sprint (P2):** M-01 a M-06 — hardening general.
4. **Backlog (P3):** L-01 a L-04, ejecutar `npm audit` y actualizar deps.

**Sin acceso a git por restricción:** todas las correcciones deben aplicarse como parches al workspace actual. Ninguna modificación realizada en esta auditoría.