# 🔐 CHECKLIST DE ROTACIÓN DE SECRETOS — LegalPro

> **Cuándo ejecutar**: INMEDIATAMENTE después de leer este documento.
> **Origen del riesgo**: hasta hoy, los `.env` del proyecto contenían secretos reales en disco. Esos secretos deben asumirse como **comprometidos**.
> **Cómo usar este checklist**: marca cada ✅ cuando completes el paso. No avances al siguiente sin completar el anterior.

---

## ⚠️ ANTES DE EMPEZAR — Reglas absolutas

1. **Trabaja en una ventana de navegación privada** (sin sesiones guardadas de Google, Supabase, Railway, Stripe).
2. **No copies los nuevos secretos a `.env` del proyecto hasta que TODOS los servicios estén actualizados**.
3. **Las claves actuales ya NO son confiables** — alguien (backup cloud, OneDrive, antivirus, sync) pudo haberlas leído.
4. **Una vez generadas las nuevas claves, las viejas quedan inválidas inmediatamente**. Si te equivocas, regenera.

---

## 🔴 PASO 1 — MiniMax API Key (CRÍTICO)

**Riesgo**: si alguien tiene tu API key, te puede gastar toda la cuota o usarla para abuso.
**Servicio real**: https://platform.minimaxi.com

- [ ] Ir a https://platform.minimaxi.com en ventana privada
- [ ] **Eliminar** la API key actual
- [ ] **Crear** nueva API key con restricción de IP (whitelist Railway IPs si el plan lo permite)
- [ ] **Copiar la nueva clave** a un lugar seguro TEMPORAL (password manager, NO .env aún)
- [ ] Verificar que `MINIMAX_API_KEY` está marcada como restringida

📍 **Dónde actualizar después**:
- Railway → servicio `legalpro-node` → Variables → `MINIMAX_API_KEY`
- Railway → servicio `legalpro-dotnet` → Variables → `MINIMAX_API_KEY`
- Railway → servicio `legalpro-frontend` → Variables → `MINIMAX_API_KEY` (si la usa en build)
- Railway → servicio `legalpro-owner-dashboard` → Variables → `MINIMAX_API_KEY`

---

## 🔴 PASO 2 — JWT Secrets (CRÍTICO)

**Riesgo**: si alguien firma un JWT con tu secreto, puede impersonar a cualquier usuario incluyendo admins.
**Servicio real**: NO es un servicio externo — los genera tu propio backend. Solo rotar el valor.

- [ ] Generar 2 secretos nuevos aleatorios de mínimo 64 caracteres base64:
  ```bash
  # En PowerShell:
  $bytes = New-Object byte[] 64
  (New-Object Random).NextBytes($bytes)
  [Convert]::ToBase64String($bytes)
  ```
  Repetir para el segundo secreto.
- [ ] **Anotar ambos en lugar seguro** (password manager) — los necesitarás para 4 servicios que deben tener EL MISMO valor.

📍 **Dónde actualizar después**:
- Railway → servicio `legalpro-node` → Variables:
  - `JWT_SECRET` = nuevo secreto 1
  - `JWT_REFRESH_SECRET` = nuevo secreto 2
- Railway → servicio `legalpro-dotnet` → Variables:
  - `JWT_SECRET` = MISMO secreto 1 (debe coincidir con Node)
  - `JWT_REFRESH_SECRET` = MISMO secreto 2 (debe coincidir con Node)

⚠️ **ATENCIÓN**: cambiar `JWT_SECRET` invalida TODAS las sesiones existentes. Todos los usuarios tendrán que hacer login de nuevo. Hacerlo en horario de bajo tráfico.

---

## 🔴 PASO 3 — Supabase Keys

**Riesgo**: si alguien tiene el `SUPABASE_SERVICE_KEY`, bypasea RLS y accede a TODOS los datos de TODOS los tenants.
**Servicio real**: https://supabase.com/dashboard/project/yddkasmxxgrmmwlotfyx/settings/api

- [ ] Ir a Supabase Dashboard → Settings → API
- [ ] **Rotar `service_role` secret** (botón "Roll new key")
- [ ] **NO rotar la `anon` key** aún — eso rompería el frontend si el código la tiene hardcoded
- [ ] Verificar que el nuevo `service_role` empieza con `eyJ...` (es un JWT)
- [ ] Copiar a password manager

📍 **Dónde actualizar después**:
- Railway → servicio `legalpro-node` → Variables → `SUPABASE_SERVICE_KEY`
- Railway → servicio `legalpro-dotnet` → Variables → `SUPABASE_SERVICE_KEY`
- Railway → servicio `legalpro-owner-dashboard` → Variables → `SUPABASE_SERVICE_KEY` (si lo usa)

---

## 🟡 PASO 4 — PostgreSQL Password (Railway Plugin)

**Riesgo**: si alguien tiene el password de la BD, puede leer/modificar TODO sin pasar por la app.
**Servicio real**: Railway Dashboard → Plugin `legalpro-postgres` → Variables → `PGPASSWORD` o `DATABASE_URL`

- [ ] Ir a Railway → proyecto `legalpro` → plugin PostgreSQL
- [ ] Buscar opción para resetear password (puede requerir `railway plugin` CLI o contacto con soporte)
- [ ] Si usas `DATABASE_URL` completo, regenerar el connection string
- [ ] Copiar nuevo password a password manager

📍 **Dónde actualizar después**:
- Railway → servicio `legalpro-node` → Variables → `DATABASE_URL`
- Railway → servicio `legalpro-dotnet` → Variables → `DATABASE_URL` (ConnectionStrings__DefaultConnection)
- Railway → servicio `legalpro-owner-dashboard` → Variables → `DATABASE_URL`

⚠️ **Orden de aplicación CRÍTICO**:
1. Cambiar password en Railway primero
2. Inmediatamente cambiar `DATABASE_URL` en Node
3. Inmediatamente cambiar `ConnectionStrings__DefaultConnection` en .NET
4. Owner Dashboard si lo usa
5. Esperar 30 segundos y verificar logs de los 3 servicios (deben reconectar)

---

## 🟡 PASO 5 — Owner Dashboard Secrets

**Riesgo**: el `OWNER_DECRYPTION_SECRET` cifra/descifra datos sensibles del owner. Si alguien lo tiene, descifra todo.
**Servicio real**: NO es servicio externo. Es tu propio backend.

- [ ] Generar nuevo `OWNER_SECRET_KEY` (string aleatorio 64+ chars)
- [ ] Generar nuevo `OWNER_DECRYPTION_SECRET` (string aleatorio 64+ chars)
- [ ] Copiar a password manager

📍 **Dónde actualizar después**:
- Railway → servicio `legalpro-owner-dashboard` → Variables:
  - `OWNER_SECRET_KEY`
  - `OWNER_DECRYPTION_SECRET`

⚠️ Cambiar `OWNER_DECRYPTION_SECRET` hace que los datos cifrados viejos sean **inrecuperables**. Solo rotar si tienes los datos descifrados respaldados o estás seguro de que no hay datos críticos encriptados con el secreto viejo.

---

## 🟢 PASO 6 — Stripe Webhook Secret (si usas Stripe)

**Riesgo**: si alguien tiene el webhook secret, puede falsificar eventos de pago.
**Servicio real**: https://dashboard.stripe.com/webhooks

- [ ] Ir a Stripe Dashboard → Webhooks → seleccionar endpoint
- [ ] Click "Roll secret"
- [ ] Copiar nuevo `whsec_...` a password manager

📍 **Dónde actualizar después**:
- Railway → servicio `legalpro-node` → Variables → `STRIPE_WEBHOOK_SECRET`

---

## ✅ PASO 7 — Verificación post-rotación

Después de actualizar TODAS las variables en TODOS los servicios:

- [ ] Esperar 2-3 minutos para que Railway redeploy automáticamente
- [ ] Abrir https://legalpro-node-production.up.railway.app/api/health (o similar)
- [ ] Verificar que responde 200 OK
- [ ] Login con `abogado@legalpro.pe` / password demo (debe pedir re-login por JWT rotado)
- [ ] Probar 1 herramienta IA (debe responder — confirma MiniMax nueva)
- [ ] Verificar en Sentry/logs que no hay errores 500
- [ ] Verificar que `datos.txt` (en tu PC) sigue intacto y ahora contiene las **claves nuevas**, no las viejas

---

## 🧹 PASO 8 — Limpieza final

- [ ] **Borrar el respaldo de claves viejas** que tenías en password manager / portapapeles / notas temporales
- [ ] **Borrar historial de portapapeles** de Windows (Win+V → Clear)
- [ ] **Cerrar ventana privada** del navegador
- [ ] **Borrar caché y cookies** de ese navegador
- [ ] Confirmar que los `.env` del proyecto siguen con placeholders (NO secretos)
- [ ] Confirmar que `datos.txt` tiene las claves nuevas

---

## 📊 RESUMEN — Qué se rotó

| # | Secreto | Servicios afectados | Tiempo estimado |
|---|---------|---------------------|-----------------|
| 1 | MINIMAX_API_KEY | 4 servicios | 5 min |
| 2 | JWT_SECRET / JWT_REFRESH_SECRET | 2 servicios | 5 min |
| 3 | SUPABASE_SERVICE_KEY | 2-3 servicios | 5 min |
| 4 | PostgreSQL password / DATABASE_URL | 3 servicios | 10 min (orden crítico) |
| 5 | OWNER_SECRET_KEY / OWNER_DECRYPTION_SECRET | 1 servicio | 5 min |
| 6 | STRIPE_WEBHOOK_SECRET | 1 servicio | 3 min |
| 7 | Verificación | — | 10 min |
| 8 | Limpieza | — | 5 min |
| | **TOTAL** | | **~45 min** |

---

## 🆘 Si algo sale mal durante la rotación

1. **NO entres en pánico**
2. **Rollback**: en Railway → servicio → Deployments → click en deployment anterior → "Redeploy"
3. Los servicios volverán al código viejo con secrets viejos (que aún no has rotado)
4. Diagnostica qué falló
5. Vuelve a intentar con más cuidado

---

## 📅 Log de rotación

> Agregar entrada cuando se complete la rotación.

### [YYYY-MM-DD] — Rotación inicial
- [ ] Pendiente — el usuario debe completar este checklist
- Generado por sesión de auditoría el 2026-06-27
- Origen: 4 archivos `.env` del proyecto fueron sobrescritos con placeholders. Las claves reales siguen en `datos.txt` pero **deben asumirse comprometidas**.
- Decisión tomada: rotación completa de TODOS los secretos externos antes de continuar con deploy a producción.