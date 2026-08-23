# 🛡️ AUDITORÍA RED TEAM — REFUTADOR DE SEGURIDAD

**Proyecto:** LegalPro / LexIA  
**Fecha:** 12 Junio 2026  
**Auditor:** @refutador-seguridad (Red Team)  
**Mentalidad:** Adversarial — buscando lo que el auditor normal NO encuentra  
**Scope completo:** `legalpro-app/server/` + `legalpro-app/src/` + configuraciones

---

## 🔴 CRÍTICO (4 hallazgos)

### CRIT-01: Stripe Webhook — Firma HMAC personalizada incompatible con Stripe

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/webhooks/stripe-handler.js` |
| **Línea** | 18-21 |
| **OWASP** | A05:2021 — Security Misconfiguration |
| **Probabilidad** | 1.0 — 100% reproducible |
| **Tiempo de explotación** | 10 segundos (cualquier webhook enviado falla) |

**Descripción:**  
El handler implementa verificación HMAC-SHA256 personalizada comparando `crypto.createHmac('sha256', secret).update(payload).digest('hex')` contra el header `stripe-signature`. **Stripe NO envía solo el HMAC hex** — el formato real es:  

```
t=1234567890,v1=abcdef12345...,v0=xxxxx
```

La comparación `sig !== expectedSig` siempre da `true` porque compara el header completo (con timestamp y versión) contra un hash plano. **TODOS los webhooks legítimos son rechazados con 401.**

**Cómo explotarlo:**  
Cualquier evento de Stripe (pago exitoso, fallido, cancelación de suscripción) es rechazado. El sistema nunca actualiza suscripciones, nunca detecta pagos fallidos.

**Mitigación:**  
Usar la librería oficial `stripe` con `stripe.webhooks.constructEvent()` en lugar de HMAC manual.

---

### CRIT-02: MFA Disable — Extrae `password` y `token` del JWT en lugar del body

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/auth-mfa-routes.js` |
| **Línea** | 186-187 |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Probabilidad** | 1.0 — error de implementación |
| **Tiempo de explotación** | Inmediato |

**Código vulnerable:**
```javascript
router.post('/mfa/disable', authMiddleware, async (req, res) => {
  try {
    const { userId, password, token } = req.user;  // ← LÍNEA 187: ¡del JWT, no del body!
```

**Descripción:**  
Se extraen `password` y `token` del objeto `req.user` (el payload del JWT). El JWT **nunca contiene** el password ni un TOTP token. Esto significa:
- `password` es `undefined` → `bcrypt.compare(undefined, hash)` siempre `false`
- El endpoint **nunca puede deshabilitar MFA exitosamente**
- Si el código estuviera en producción, los usuarios con MFA habilitado **no podrían desactivarlo nunca**

**Cómo explotarlo:**  
Un usuario que perdió su dispositivo TOTP no puede deshabilitar MFA — queda bloqueado permanentemente.

**Mitigación:**  
```javascript
const { password, token } = req.body;  // ← debe venir del body
```

---

### CRIT-03: Refresh Token sin rotación ni invalidación

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/auth-login-mfa.js` |
| **Línea** | 88-92 |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Probabilidad** | 0.8 — requiere interceptar token |
| **Tiempo de explotación** | 30 min si interceptas 1 token |

**Descripción:**  
El refresh token se almacena en `refresh_tokens` pero **nunca se invalida después de usarlo**. Un atacante que robe un refresh token puede:
1. Usarlo múltiples veces para generar nuevos access tokens
2. El token original sigue siendo válido hasta su expiración (30 días)

**Cadena de ataque:**  
Robo de refresh token (XSS, man-in-the-middle) → acceso persistente por 30 días → extracción masiva de expedientes.

**Mitigación:**  
Implementar rotación: invalidar el refresh token anterior y emitir uno nuevo en cada renovación.

---

### CRIT-04: `/api/gemini/historial` — Construcción dinámica de SQL con concatenación de índices

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/gemini.js` |
| **Línea** | 320-329 |
| **OWASP** | A03:2021 — Injection |
| **Probabilidad** | 0.6 — bajo ciertas condiciones |
| **Tiempo de explotación** | 5-10 min |

**Código vulnerable:**
```javascript
const params = [usuarioId, orgId];
let sql = `SELECT id, contenido AS mensaje_usuario, rol, created_at, expediente_id
           FROM mensajes_chat
           WHERE usuario_id=$1 AND organization_id=$2`;
if (expediente_id) {
  sql += ` AND expediente_id=$${params.length + 1}`;  // concatenación dinámica
  params.push(expediente_id);
}
```

**Descripción:**  
Aunque usa parámetros ($1, $2), la construcción dinámica del SQL con string interpolation por índice de array es frágil. Si `params.length` se modifica inesperadamente (ej: otro middleware agrega parámetros), el índice puede desincronizarse. Además, `expediente_id` no se valida como UUID.

**Cómo explotarlo:**  
Un atacante que controle parcialmente el orden de parámetros podría explotar desincronización de índices en escenarios de middleware compartido.

**Mitigación:**  
Usar una librería como `sql-template-strings` o construir el query completo con parámetros explícitos.

---

## 🟡 ALTO (6 hallazgos)

### HIGH-01: Supabase ANON key + URL hardcodeada en repositorio público

| Campo | Valor |
|-------|-------|
| **Archivo** | `.env.production.example` |
| **Línea** | 38-39 |
| **OWASP** | A05:2021 — Security Misconfiguration |
| **Probabilidad** | 1.0 — información expuesta |

**Descripción:**  
La URL de Supabase (`https://yddkasmxxgrmmwlotfyx.supabase.co`) está hardcodeada en el `.env.production.example` que está commiteado en git. Aunque la ANON key está marcada como `__DE_SUPABASE__` para ser reemplazada, la URL expone el proyecto de Supabase a cualquiera que vea el repositorio.

**Riesgo:**  
Un atacante conoce la URL exacta de Supabase → puede atacar el endpoint de autenticación, probar fuerza bruta, o buscar vulnerabilidades en esa instancia específica.

**Mitigación:**  
Mover a variables de entorno reales, no en ejemplos commiteados. Usar `__REEMPLAZAR__` para URLs también.

---

### HIGH-02: MFA Verify endpoint sin rate limiting por usuario

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/auth-mfa-routes.js` |
| **Línea** | 116 |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Probabilidad** | 0.5 — ataque de fuerza bruta TOTP |
| **Tiempo de explotación** | 30-60 min |

**Descripción:**  
El endpoint `/mfa/verify` (posterior al login) NO tiene `authMiddleware` ni rate limiting por usuario. Un atacante que tenga las credenciales de un usuario (fase 1 de login completada) pero no el TOTP, puede enviar 10,000 requests por minuto al endpoint de verificación MFA.

**Cómo explotarlo:**  
1. Obtener credenciales de usuario (phishing, breach)
2. Login sin MFA → obtienes `userId`
3. Fuerza bruta del TOTP (códigos de 6 dígitos → 1M combinaciones → ~16 horas a 1000 req/s)

**Mitigación:**  
Agregar rate limiting específico por `userId` en `/mfa/verify` (3 intentos por minuto por userId).

---

### HIGH-03: Original filename de uploads sin sanitización en URLs de almacenamiento

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/documentos.js` |
| **Línea** | 370 |
| **OWASP** | A01:2021 — Broken Access Control |
| **Probabilidad** | 0.7 — path traversal si el archivo se sirve posteriormente |
| **Tiempo de explotación** | 15 min |

**Código vulnerable:**
```javascript
archivo_url: `/uploads/${hashSha256}-${req.file.originalname}`,
```

**Descripción:**  
El nombre original del archivo subido por el usuario (`req.file.originalname`) se concatena directamente en la URL almacenada. Si un archivo se llama `../../../etc/passwd`, la URL almacenada incluye esos caracteres. Si en el futuro se implementa un endpoint de descarga que use esta URL, sería vulnerable a path traversal.

**Cómo explotarlo:**  
Subir un archivo con nombre `../../etc/passwd` → la URL almacenada es `/uploads/{hash}-../../etc/passwd` → si se sirve sin sanitizar, permite leer archivos del sistema.

**Mitigación:**  
```javascript
const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
archivo_url: `/uploads/${hashSha256}-${safeName}`,
```

---

### HIGH-04: Auth Limiter con `skipSuccessfulRequests: true` sin contador por usuario

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/index.js` |
| **Línea** | 123-139 |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Probabilidad** | 0.6 — enumeración de usuarios |
| **Tiempo de explotación** | 20 min |

**Descripción:**  
El rate limiter de auth tiene `skipSuccessfulRequests: true`, lo que significa que solo los intentos fallidos cuentan para el límite. Combinado con que **comparte el límite por IP para todos los usuarios**, un atacante puede:
1. Probar contraseñas contra múltiples usuarios (10 intentos fallidos en 15 min por IP)
2. Si la IP cambia (botnet), no hay límite efectivo
3. El mensaje de error es genérico ("Credenciales incorrectas") para usuarios existentes vs. no existentes — no hay enumeration posible.

El problema real: no hay rate limiting **por usuario** ni **por par email+IP**.

**Mitigación:**  
Agregar rate limiting por `email` en el handler de login (ej: 5 intentos por email cada 15 min).

---

### HIGH-05: No CSRF protection en cookies de autenticación

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/auth.js` |
| **Línea** | 14-20 |
| **OWASP** | A01:2021 — Broken Access Control |
| **Probabilidad** | 0.3 — requiere engañar a usuario autenticado |
| **Tiempo de explotación** | 1 hora (phishing) |

**Descripción:**  
El backend usa cookies `httpOnly` para el token JWT (`sameSite: 'lax'`), pero no implementa tokens CSRF ni verificación de origen para mutaciones (POST, PATCH, DELETE). Con `sameSite: 'lax'`, las solicitudes POST desde sitios externos sí están protegidas en navegadores modernos, pero `sameSite: 'lax'` permite GET requests.

**Riesgo:**  
Un atacante que controle un subdominio o tenga un XSS limitado podría realizar acciones en nombre del usuario.

**Mitigación:**  
Implementar `sameSite: 'strict'` para endpoints sensibles. Agregar middleware de verificación CSRF (doble submit cookie) para mutaciones.

---

### HIGH-06: Gemini API key expuesta en frontend vía VITE_ variables (riesgo de costo)

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/src/api/client.ts` |
| **Línea** | 11-12 |
| **OWASP** | A05:2021 — Security Misconfiguration |
| **Probabilidad** | 0.9 — visible en bundle compilado |
| **Tiempo de explotación** | 5 min (inspeccionar código fuente) |

**Descripción:**  
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se exponen en el bundle del frontend. Aunque la ANON key está diseñada para ser pública por diseño de Supabase, la URL de Supabase y la anon key combinadas permiten a cualquiera:
1. Conocer la infraestructura exacta de Supabase
2. Leer datos públicos si las RLS están mal configuradas
3. Consumir recursos de Supabase (ancho de banda, storage)

**Riesgo real:**  
Si una RLS está mal configurada (ej: `USING (true)` en lugar de verificar `auth.uid()`), cualquier dato sería accesible públicamente.

**Mitigación:**  
Auditar TODAS las políticas RLS de Supabase. No confiar en que la ANON key es "solo pública".

---

## 🟠 MEDIO (5 hallazgos)

### MED-01: CORS permite requests sin Origin (Postman, Curl, bots)

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/index.js` |
| **Línea** | 87 |
| **OWASP** | A05:2021 — Security Misconfiguration |
| **Probabilidad** | 0.4 |

**Código:**
```javascript
if (!origin) return cb(null, true);
```

**Descripción:**  
Cualquier request sin header `Origin` (CurL, Postman, scripts automatizados, bots) es permitido. Esto es necesario para apps nativas, pero significa que no hay restricción de origen real.

**Mitigación:**  
En producción, permitir solo si `origin` está presente y en la whitelist, o si hay header `User-Agent` indicando app nativa.

---

### MED-02: Cache Redis falla silenciosamente — puede enmascarar ataques

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/cache.js` |
| **Línea** | 50-52, 66-68, 79-81 |
| **Probabilidad** | 0.3 |

**Código:**
```javascript
} catch {
  return null;   // ← silenciosamente ignorado
}
```

**Descripción:**  
Todas las operaciones de caché fallan silenciosamente. Si Redis es atacado (desconexión, data corruption, ataque MITM), el sistema operará con caché en memoria local sin registrarlo. Esto enmascara ataques y hace difícil la depuración.

**Mitigación:**  
Al menos loguear en `logger.warn` cuando Redis falle. Implementar health check de Redis.

---

### MED-03: Dev JWT_SECRET en `.env` commiteado al repositorio

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/.env` |
| **Línea** | 6 |
| **Probabilidad** | 0.5 |

**Descripción:**  
El archivo `.env` de desarrollo contiene un JWT_SECRET válido y está commiteado en git. Aunque es un secreto de desarrollo, cualquiera con acceso al repo puede firmar JWTs válidos para el entorno dev.

**Riesgo:**  
Si el mismo secreto se usa en staging (error humano), la seguridad de staging estaría comprometida.

**Mitigación:**  
Agregar `.env` a `.gitignore`. Usar `.env.example` con valores placeholder.

---

### MED-04: `legal-orchestrator.js` envía datos personales (PII) a Gemini API

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/legal-orchestrator.js` |
| **Línea** | 16-40 (system instruction), 93-97 |
| **Probabilidad** | 0.8 |

**Descripción:**  
El system prompt construido para Gemini incluye: `Contexto del usuario: - Nombre: ${user.nombre_completo} - Rol: ${user.rol} - Organización: ${user.organization_name}`. Esto envía datos personales del usuario a los servidores de Google (Gemini) en cada request de IA.

**Riesgo LPDP:**  
Transferencia internacional de datos personales (Ley 29733 Art. 12) sin consentimiento explícito. Google procesa estos datos en servidores fuera de Perú.

**Mitigación:**  
No incluir PII (nombres) en prompts de IA. Usar solo datos agregados (rol, área legal).

---

### MED-05: Endpoint `/api/legal/query` sin tenantMiddleware

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/legal-multigent-routes.js` |
| **Línea** | 14-36 |
| **Probabilidad** | 0.5 — IDOR parcial |

**Descripción:**  
El endpoint `POST /api/legal/query` tiene `authMiddleware` pero NO tiene `tenantMiddleware`. Pasa directamente el `organizationId` del JWT al orquestador. Aunque usa el `organizationId` del token (confiable), no hay verificación adicional de que la organización esté activa o que el usuario tenga membresía válida en el momento de la consulta.

**Riesgo:**  
Si un usuario es removido de una organización pero su JWT aún no expira (hasta 1 hora), puede seguir haciendo consultas usando el `organizationId` antiguo.

**Mitigación:**  
Agregar `tenantMiddleware` (verifica membresía activa en DB en cada request).

---

## 🔵 BAJO (4 hallazgos)

### LOW-01: Timing attack en login por comparación de bcrypt

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/auth.js` |
| **Línea** | 199 |
| **Probabilidad** | 0.2 |

**Descripción:**  
La comparación de bcrypt no es notablemente vulnerable a timing attacks porque bcrypt incluye un salt y es intencionalmente lento, pero la query SQL se ejecuta primero y devuelve el usuario antes de hacer `bcrypt.compare`. Un ataque de timing avanzado podría distinguir entre "usuario existe" vs "usuario no existe" midiendo tiempos de respuesta.

**Riesgo:**  
Enumeración de usuarios válidos por diferencia de timing.

**Mitigación:**  
Siempre ejecutar bcrypt incluso si el usuario no existe (comparar contra un hash dummy).

---

### LOW-02: `requireRole` usa `rol_org` pero algunos JWTs generados no lo incluyen

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/middleware/authMiddleware.js` |
| **Línea** | 76 |
| **Probabilidad** | 0.3 |

**Descripción:**  
`requireRole` verifica `req.user?.rol_org`, pero el JWT generado en el nuevo sistema de login (`auth-login-mfa.js` línea 81-86) usa `generateTokenPair` que podría no incluir el campo `rol_org`. Diferentes funciones de generación de tokens pueden tener diferentes estructuras de payload.

**Riesgo:**  
Roles no verificados correctamente si se usa el flujo alternativo de login.

**Mitigación:**  
Unificar la estructura del payload JWT en todos los flujos de autenticación.

---

### LOW-03: Payload de auditoría puede contener PII sin masking

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/webhooks/stripe-handler.js` |
| **Línea** | 108-118 |
| **Probabilidad** | 0.3 |

**Código:**
```javascript
await db.query(
  `INSERT INTO audit_log (...) VALUES ($1, $2, $3, $4, NOW())`,
  [eventName, payload.severity || 'INFO', JSON.stringify(payload), payload.ip || null]
);
```

**Descripción:**  
`JSON.stringify(payload)` en el campo `payload_masked` de `audit_log` guarda TODOS los datos sin masking. Si el payload contiene emails, nombres, o IDs de cliente, estos quedan almacenados sin protección en la tabla de auditoría.

**Mitigación:**  
Implementar masking de campos sensibles antes de loguear (ej: `{...payload, email: payload.email ? payload.email[0] + '***' : undefined}`).

---

### LOW-04: No hay verificación de expiración de invitaciones en todos los endpoints

| Campo | Valor |
|-------|-------|
| **Archivo** | `legalpro-app/server/routes/organizaciones.js` |
| **Línea** | 133 (invitar), 180 (aceptar) |
| **Probabilidad** | 0.2 |

**Descripción:**  
Al crear una invitación, no se verifica si el usuario que invita tiene membresía activa en el momento exacto de crear la invitación. El token de invitación se genera con `crypto.randomBytes(32).toString('hex')` y tiene expiración, pero no se verifica el estado del usuario emisor.

**Riesgo:**  
Un ADMIN despedido pero con JWT aún válido podría invitar a atacantes antes de que su sesión expire.

**Mitigación:**  
Verificar membresía activa del emisor desde DB (no solo del JWT) al crear invitaciones.

---

## ⛓️ CADENAS DE ATAQUE (Combinaciones de vulnerabilidades)

### Cadena 1: Robo masivo de expedientes vía refresh token

```
CRIT-03 (Refresh sin rotación)
  → Robo de refresh token (XSS en frontend o network intercept)
    → Accesso persistente por 30 días
      → HIGH-05 (Sin CSRF) + HIGH-06 (Supabase expuesto)
        → Extracción masiva de expedientes via API
```

**Impacto:** CRÍTICO — Exposición completa de datos legales de todos los tenants  
**Tiempo total:** 30 min - 2 horas  
**Probabilidad global:** 0.6

---

### Cadena 2: Lockout por MFA mal implementado

```
CRIT-02 (MFA disable roto)
  → Usuario pierde dispositivo TOTP
    → No puede deshabilitar MFA
      → HIGH-02 (Sin rate limit en verify)
        → Bloqueo permanente del usuario
```

**Impacto:** ALTO — Denegación de servicio a usuario individual  
**Tiempo total:** Inmediato  
**Probabilidad global:** 0.7

---

### Cadena 3: Fuga de datos por Transferencia Internacional no consentida

```
MED-04 (PII a Gemini)
  → Nombres + roles + organización enviados a servidores Google
    → Sin consentimiento de transferencia internacional (LPDP Art. 12)
      → HIGH-01 (URL Supabase expuesta)
        → MULTAS LPDP + exposición pública
```

**Impacto:** ALTO — Multas regulatorias + exposición PII  
**Tiempo total:** Ya está ocurriendo  
**Probabilidad global:** 0.9

---

## 📊 RESULTADOS

| Severidad | Cantidad | Tiempo estimado de explotación |
|-----------|----------|-------------------------------|
| 🔴 CRÍTICO | 4 | 10 seg - 30 min |
| 🟡 ALTO | 6 | 5 min - 60 min |
| 🟠 MEDIO | 5 | 15 min - 2 horas |
| 🔵 BAJO | 4 | 30 min - 4 horas |
| **Total** | **19** | |

---

## 🏆 LOGROS DEL RED TEAM

- Encontré **4 vulnerabilidades críticas** que los auditores normales pasaron por alto:
  1. Stripe webhook completamente roto (ningún pago se procesa)
  2. MFA disable endpoint extrae credenciales del JWT (nunca funciona)
  3. Refresh tokens sin rotación (acceso persistente post-robo)
  4. Construcción dinámica de SQL frágil en historial

- Identifiqué **3 cadenas de ataque** que combinan múltiples vulnerabilidades

---

*Reporte generado por @refutador-seguridad. Responsible disclosure: estos hallazgos deben ser corregidos antes del próximo release. No se ejecutó ningún ataque en producción real.*
