# Plan de Rotación de Secretos Excomprometidos — LegalPro

> **Fecha de generación:** 2026-05-04  
> **Auditor responsable:** Especialista Senior en Seguridad de Aplicaciones  
> **Impacto:** CRÍTICO — Secretos expuestos en historial de Git público  
> **Estado:** Limpieza del historial completada localmente. Rotación de secretos en servicios externos **PENDIENTE**.

---

## 1. Resumen de Secretos Expuestos

Durante auditorías de seguridad se detectaron credenciales de producción trackeadas en el historial del repositorio Git `Abogacia/LegalPro`. Aunque los archivos fueron posteriormente eliminados o sanitizados en el working tree, los secretos originales permanecían accesibles mediante `git log` y `git show` en commits antiguos.

| Secreto | Tipo | Ubicación histórica detectada | Severidad |
|---|---|---|---|
| `${{POSTGRES_PASSWORD}}` | Password PostgreSQL (Railway) | `legalpro-app/apply-schema.mjs`, `check-db-tables.mjs`, `seed-admin.mjs`, `test-same-db.mjs` (commit `64f3add`) | **CRÍTICA** |
| `mk-...` | MiniMax API Key | Pendiente de configuración | **ALTA** |
| `${{JWT_SECRET}}` | JWT Secret (firma de tokens) | No encontrado en el historial actual del repo. Posiblemente ya fue removido en limpiezas previas o reside en otro repositorio. | **CRÍTICA** |

### Nota sobre los secretos antiguos
Las búsquedas exhaustivas (`git log -S`, `git log -G`, `git grep` en `git rev-list --all`) no arrojaron resultados para la API Key de MiniMax ni para el JWT Secret en el historial actual del repositorio `Abogacia`. Esto indica que:
- Ya fueron eliminados en limpiezas anteriores, **o**
- Residen en un repositorio diferente, **o**
- Estaban en archivos que nunca fueron commiteados (solo en working tree).

> **Recomendación:** Ejecutar `git log --all -p | grep -i "mk-\|jwt\|secret"` en cualquier otro repositorio o backup que pudiera contener código fuente de LegalPro.

---

## 2. Acciones Inmediatas Requeridas

Las siguientes acciones deben ejecutarse **en las próximas 24 horas** para mitigar el riesgo de acceso no autorizado.

### 2.1 Railway (PostgreSQL)
- [ ] **Rotar password de la base de datos** desde el dashboard de Railway.
- [ ] **Actualizar la variable de entorno** `DATABASE_PUBLIC_URL` (o `DATABASE_URL`) en todos los servicios de Railway que consuman la DB.
- [ ] **Verificar conexiones activas** y forzar reconexión de todos los servicios.
- [ ] **Revisar logs de Railway** en busca de conexiones sospechosas desde IPs no reconocidas.

### 2.2 MiniMax AI (API Key)
- [ ] **Revocar la API Key** `${{GEMINI_API_KEY}}` en Google Cloud Console → APIs & Services → Credentials.
- [ ] **Generar nueva API Key** para el proyecto de producción.
- [ ] **Restringir la nueva key** por IP o referer (si es posible) para limitar su uso.
- [ ] **Actualizar la variable de entorno** `MINIMAX_API_KEY` (o equivalente) en Railway y en cualquier despliegue local/CI.

### 2.3 LegalPro Application (JWT Secret)
- [ ] **Generar un nuevo JWT Secret** de al menos 256 bits (32 bytes) de longitud. Ejemplo de generación segura:
  ```bash
  openssl rand -base64 32
  # o
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- [ ] **Rotar el secreto en Railway** actualizando la variable de entorno `JWT_SECRET`.
- [ ] **Forzar cierre de sesión de todos los usuarios** activos, ya que los tokens firmados con el secreto anterior seguirán siendo válidos hasta su expiración.
- [ ] **Considerar reducir el TTL** de los tokens JWT a un valor más corto (ej. 15 minutos de acceso + refresh token) mientras se completa la rotación.

---

## 3. Pasos Detallados para Rotar Cada Secreto

### 3.1 PostgreSQL Password (`${{POSTGRES_PASSWORD}}`)

**Paso 1: Rotar en Railway**
1. Ingresar a [https://railway.app](https://railway.app).
2. Navegar al proyecto `LegalPro` → servicio PostgreSQL.
3. Ir a la pestaña **Variables** o **Settings**.
4. Generar una nueva contraseña (Railway suele tener un botón "Reset Password").
5. Copiar la nueva `DATABASE_URL` generada.

**Paso 2: Actualizar servicios dependientes**
- Servicio Node.js (`legalpro-node`)
- Servicio .NET (`legalpro-dotnet`) — si comparte la misma instancia
- Cualquier script de migración o CLI local

**Paso 3: Redesplegar**
- Railway automáticamente inyecta las nuevas variables, pero es recomendable hacer un redeploy manual de cada servicio para asegurar que la nueva conexión se establezca inmediatamente.

**Paso 4: Verificación**
```bash
# Desde un servicio Node.js conectado
node -e "const pgp = require('pg-promise')(); const db = pgp(process.env.DATABASE_URL); db.one('SELECT current_database()').then(r => console.log('DB OK:', r.current_database')).catch(e => console.error('DB FAIL:', e.message))"
```

### 3.2 MiniMax API Key

**Paso 1: Revocar en MiniMax Platform**
1. Ir a [https://platform.minimaxi.com](https://platform.minimaxi.com).
2. Localizar la key actual.
3. Revocarla.

**Paso 2: Crear nueva key**
1. Crear nueva API key.
2. Asignar un nombre descriptivo: `LegalPro-Production-MiniMax-2026`.
3. Aplicar restricciones de IP si es posible.
4. Copiar la nueva key.

**Paso 3: Actualizar entornos**
- Railway: variable `MINIMAX_API_KEY` en los servicios que usan IA.
- GitHub Actions (si aplica): actualizar secretos del repositorio (`Settings → Secrets and variables → Actions`).
- Repositorio local: si hay archivos `.env` o `.env.local`, actualizarlos (asegurándose de que NO se commiteen).

**Paso 4: Verificación**
```bash
curl https://api.minimaxi.com/v1/text/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ${MINIMAX_API_KEY}' \
  -X POST \
  -d '{"model": "MiniMax-M3", "messages": [{"role": "user", "content": "Test de conexión LegalPro"}]}'
```

### 3.3 JWT Secret (`${{JWT_SECRET}}`)

**Paso 1: Generar nuevo secreto**
```bash
# Linux / macOS / Git Bash
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
```

**Paso 2: Actualizar variables de entorno**
- Railway: `JWT_SECRET` en todos los servicios que firmen/verifiquen tokens (Node, .NET, owner-api).
- Docker Compose local (si aplica): `docker-compose.yml` o `.env`.

**Paso 3: Forzar invalidez de tokens antiguos**
- **Opción A (inmediata):** Cambiar el nombre del claim `issuer` o `audience` en la configuración JWT. Esto invalida TODOS los tokens antiguos instantáneamente.
- **Opción B (gradual):** Mantener la configuración actual, pero reducir el tiempo de expiración de access tokens a 5-15 minutos y emitir nuevos refresh tokens. Los usuarios se reautenticarán transparentemente.

**Paso 4: Notificar a usuarios activos**
- Enviar comunicación interna/equipo informando que deberán volver a iniciar sesión.
- Monitorear errores 401/403 en los logs de los próximos 30 minutos.

**Paso 5: Verificación**
```bash
# Node.js
node -e "const jwt = require('jsonwebtoken'); const token = jwt.sign({sub:'test'}, process.env.JWT_SECRET, {expiresIn:'1m'}); console.log('Token generado OK'); console.log(jwt.verify(token, process.env.JWT_SECRET))"
```

---

## 4. Verificación Post-Rotación

Una vez rotados los secretos, ejecutar la siguiente checklist:

- [ ] **Conectividad DB:** El backend Node puede iniciar sesión y ejecutar queries sin errores de autenticación PostgreSQL.
- [ ] **Conectividad DB .NET:** El backend .NET puede conectarse y correr migraciones EF Core.
- [ ] **MiniMax API:** Las herramientas de IA (analista de expedientes, redactor de escritos, etc.) responden correctamente sin errores 403/API key invalid.
- [ ] **Autenticación JWT:** Login, registro y endpoints protegidos funcionan. Tokens nuevos son aceptados.
- [ ] **Tokens antiguos rechazados:** Un token firmado con `${{JWT_SECRET}}` debe ser rechazado con 401.
- [ ] **CI/CD pasa:** Los pipelines de GitHub Actions que usan secretos pasan correctamente.
- [ ] **Smokes tests en producción:** Ejecutar `smoke-production.mjs` o equivalente contra la URL de producción.
- [ ] **Revisión de logs:** No hay errores de conexión a DB, ni errores 403 de MiniMax, ni picos de 401 inesperados.

### Scripts de verificación sugeridos

```bash
# 1. Verificar que el secreto antiguo NO está en ningún archivo local
grep -r "${{POSTGRES_PASSWORD}}" . --exclude-dir=node_modules --exclude-dir=.git
grep -r "${{GEMINI_API_KEY}}" . --exclude-dir=node_modules --exclude-dir=.git
grep -r "${{JWT_SECRET}}" . --exclude-dir=node_modules --exclude-dir=.git

# 2. Verificar que el secreto antiguo NO está en el historial de Git
git log --all -p -S "${{POSTGRES_PASSWORD}}"
git log --all -p -S "${{GEMINI_API_KEY}}"
git log --all -p -S "${{JWT_SECRET}}"

# 3. Verificar que el nuevo JWT funciona
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log('Nuevo token:', token.substring(0, 50) + '...');
console.log('Verificado:', jwt.verify(token, process.env.JWT_SECRET));
"
```

---

## 5. Timeline Recomendado

| Horas desde ahora | Acción | Responsable |
|---|---|---|
| **0h** | Limpieza del historial de Git completada (local). | Seguridad |
| **0-2h** | Rotar PostgreSQL password en Railway. | DevOps / Backend Lead |
| **0-2h** | Revocar MiniMax API Key y generar nueva. | DevOps / Backend Lead |
| **2-4h** | Actualizar `DATABASE_URL` y `MINIMAX_API_KEY` en todos los servicios de Railway. | DevOps |
| **4-6h** | Generar nuevo JWT Secret y desplegar en Railway. Forzar cierre de sesión global. | Backend Lead |
| **6-8h** | Ejecutar verificación post-rotación completa (DB, MiniMax, JWT, CI/CD, smoke tests). | QA / Backend |
| **8-24h** | Monitoreo activo de logs en Railway y Google Cloud. Revisar alertas de 401/403/DB connection errors. | DevOps |
| **24-48h** | Auditoría final: confirmar que ningún servicio intenta conectar con credenciales antiguas. | Seguridad |
| **48h+** | Documentar lecciones aprendidas. Reforzar pre-commit hooks (`detect-secrets`, `git-secrets`, `truffleHog`). | Seguridad / DevOps |

---

## 6. Medidas Preventivas Futuras

Para evitar que esta situación se repita, implementar las siguientes medidas:

1. **Pre-commit hooks obligatorios:**
   ```bash
   # Opción 1: detect-secrets (Yelp)
   pip install detect-secrets
   detect-secrets scan > .secrets.baseline
   detect-secrets hook --baseline .secrets.baseline

   # Opción 2: truffleHog
   trufflehog git file://. --since-commit HEAD --only-verified
   ```

2. **`.gitignore` robusto:**
   Asegurar que todos los archivos de entorno estén ignorados:
   ```gitignore
   .env
   .env.*
   !.env.example
   *.local
   ```

3. **Política de "secrets en variables de entorno":**
   Nunca hardcodear secretos en archivos de código, ni siquiera en scripts temporales de migración o diagnostico.

4. **Revisión de PRs enfocada en seguridad:**
   Todo PR que modifique archivos de configuración, conexión a DB o autenticación debe ser aprobado por el agente/rol de seguridad.

5. **Rotación periódica automatizada:**
   - JWT Secrets: rotar cada 90 días.
   - API Keys: rotar cada 180 días.
   - DB passwords: rotar cada 180 días o tras cualquier incidente de seguridad.

6. **Scanning continuo del historial:**
   Ejecutar trimestralmente:
   ```bash
   trufflehog git file://. --since-commit $(git rev-list --max-parents=0 HEAD)
   ```

---

## 7. Notas Técnicas de la Limpieza

- **Herramienta utilizada:** `git-filter-repo` v2.47.0 (alternativa moderna a BFG Repo-Cleaner).
- **Comando ejecutado:** `git filter-repo --replace-text passwords.txt --force`
- **Secreto confirmado eliminado:** `${{POSTGRES_PASSWORD}}` → reemplazado por `REMOVED_SECRET` en el commit `64f3add` y todos sus ancestros.
- **Garbage collection:** `git reflog expire --expire=now --all` + `git gc --prune=now --aggressive`.
- **Remote `origin` removido:** Esto es comportamiento normal de `git-filter-repo` por seguridad. No se ha modificado el repositorio remoto en GitHub. Para sincronizar, será necesario forzar push (`git push --force`) **solo después de confirmar que todos los colaboradores han actualizado sus clones locales**.
- **Stash reescrito:** El stash local fue reescrito para mantener consistencia con los nuevos hashes de commits.

---

## 8. Contactos y Escalamiento

| Rol | Responsabilidad |
|---|---|
| **DevOps Lead** | Ejecución de rotación en Railway, actualización de variables de entorno, monitoreo de logs. |
| **Backend Lead** | Generación de nuevo JWT Secret, validación de endpoints protegidos, smoke tests. |
| **QA Engineer** | Verificación post-rotación, ejecución de tests E2E, validación de flujos críticos. |
| **Seguridad** | Auditoría final, revisión de pre-commit hooks, documentación de incidente. |

---

> ⚠️ **ADVERTENCIA CRÍTICA:** El repositorio remoto en GitHub (`origin`) **NO ha sido modificado**. Los secretos aún son visibles en GitHub hasta que se ejecute `git push --force` en la rama `main` (y cualquier otra rama que contenga el commit `64f3add` o sus ancestros). **No ejecutar push --force hasta que todo el equipo esté alineado**, ya que reescribe la historia pública y puede causar conflictos graves a otros colaboradores.
