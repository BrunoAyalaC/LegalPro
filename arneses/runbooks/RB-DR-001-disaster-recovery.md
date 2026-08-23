# RB-DR-001: Disaster Recovery — LegalPro

## Metadata
- **Severidad**: P0
- **Owner**: @SRE + @devops
- **Última actualización**: 2026-06-27 (actualizado con comandos PowerShell ejecutables)
- **RTO objetivo**: 1 hora (Recovery Time Objective)
- **RPO objetivo**: 1 hora (Recovery Point Objective) — depende del cron configurado

## ⚠️ Antes de usar este runbook

1. **Mantén la calma** — Disaster recovery con estrés causa más daño que el incidente original
2. **Comunica** — avisa al equipo ANTES de tomar acciones destructivas
3. **Documenta** — cada acción que tomes, anota timestamp y resultado
4. **NO improvises** — sigue los pasos en orden

---

## 🚨 ESCENARIO 1: PostgreSQL Down pero backups disponibles

**Síntomas**: errores 500 en endpoints que tocan BD, Railway muestra plugin PostgreSQL en rojo.

### Paso 1: Verificar estado (5 min)

```powershell
# Railway Dashboard → PostgreSQL plugin → Metrics → ¿CPU/memoria normales?
# Si Railway dice "DATABASE_URL changed" → puede ser problema de conexión, no de BD

# Verificar conectividad desde tu PC
psql "postgresql://user:***@host.railway.app:port/dbname?sslmode=require" -c "SELECT 1;"
# Si responde "1" → la BD está bien, el problema es otro (ver RB-006)
# Si no responde → continuar
```

### Paso 2: Intentar recovery automático (10 min)

```powershell
# En Railway Dashboard → PostgreSQL plugin → Restart
# Esperar 60 segundos

# Verificar logs
railway logs --service legalpro-postgres 2>&1 | tail -50
# (requiere Railway CLI; alternativa: Dashboard → Logs)
```

### Paso 3: Si no se recupera, rollback del último deploy Node/.NET que pudo haber roto algo

```powershell
# Railway Dashboard → servicio legalpro-node → Deployments → click en deploy anterior → "Redeploy"
# Railway Dashboard → servicio legalpro-dotnet → Deployments → click en deploy anterior → "Redeploy"

# Esperar 2 minutos y verificar
curl https://legalpro-node-production.up.railway.app/api/health
```

### Paso 4: Si sigue roto, escalar al equipo de soporte de Railway

Dashboard → Help → Support → abrir ticket con logs y timestamps.

---

## 🚨 ESCENARIO 2: Pérdida de datos (rollback de BD)

**Síntomas**: datos corruptos, deploy rompió schema, usuario reporta eliminación accidental masiva.

### ⚠️ ADVERTENCIA: este procedimiento BORRA los datos actuales de la BD

### Paso 1: Listar backups disponibles (2 min)

```powershell
# Si usas S3:
aws s3 ls s3://legalpro-backups/daily/ | Sort-Object -Descending | Select-Object -First 10

# Si los guardas localmente:
Get-ChildItem C:\backups\legalpro_*.sql* | Sort-Object LastWriteTime -Descending | Select-Object -First 10
```

### Paso 2: Elegir el backup más reciente que SABES que está bien

Si no sabes cuál está bien:
- Elige el de 1 hora antes del incidente
- Si los deployments son la causa, elige el de 1 día antes

### Paso 3: Crear safety backup del estado actual (5 min)

```powershell
# ⚠️ Esto es por si necesitas volver al estado "roto pero conocido"
$env:PGPASSWORD = "***"
pg_dump --host=<host> --port=<port> --username=<user> --dbname=<dbname> `
  --no-owner --no-privileges --format=custom --compress=9 `
  --file="C:\backups\pre_recovery_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql.gz"
```

### Paso 4: Restaurar (10-30 min dependiendo del tamaño)

Opción A — Script automatizado (recomendado):
```powershell
.\tools\backup\restore.ps1 latest
# (crear wrapper PowerShell del .sh si no existe)
```

Opción B — Manual:
```powershell
# 1. Drop schema
$env:PGPASSWORD = "***"
psql --host=<host> --port=<port> --username=<user> --dbname=<dbname> `
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO <user>;"

# 2. Restaurar
psql --host=<host> --port=<port> --username=<user> --dbname=<dbname> `
  --file="C:\backups\legalpro_20260627_020000.sql"
```

### Paso 5: Validar (15 min)

```powershell
# Smoke test contra el backend
node server/smoke-production.mjs

# Login manual con usuario demo
# Verificar datos clave (expedientes, usuarios, etc.)
```

---

## 🚨 ESCENARIO 3: Ransomware / Breach LPDP (CRÍTICO)

**Síntomas**: encriptación de archivos, accesos no autorizados detectados, ransomware nota visible.

### ⚠️ LPDP: tienes <= 5 días hábiles para notificar a ANPDP

### Paso 1: CONGELAR todos los servicios inmediatamente (5 min)

```powershell
# En Railway Dashboard, para CADA servicio:
# Settings → "Sleep" o "Delete Service" (delete es destructivo, sleep es reversible)

# legalpro-node → Settings → Sleep
# legalpro-dotnet → Settings → Sleep
# legalpro-frontend → Settings → Sleep
# legalpro-owner → Settings → Sleep

# Verificar que ninguno responde
curl https://legalpro-node-production.up.railway.app/api/health
# Debe dar timeout / connection refused
```

### Paso 2: Aislar la BD (5 min)

```powershell
# Railway Dashboard → PostgreSQL plugin → Settings → Restrict IP Access (si está disponible)
# Alternativa: rotar DATABASE_URL (ver SECRETS_ROTATION_CHECKLIST)
```

### Paso 3: Preservar evidencia (30 min)

```powershell
# Antes de restaurar nada, copiar logs
railway logs --service legalpro-node 2>&1 | Out-File C:\evidence\legalpro-node-logs.txt
railway logs --service legalpro-dotnet 2>&1 | Out-File C:\evidence\legalpro-dotnet-logs.txt
railway logs --service legalpro-postgres 2>&1 | Out-File C:\evidence\legalpro-postgres-logs.txt

# Tomar snapshot de la BD antes de restaurar
# (ver Paso 3 de Escenario 2)
```

### Paso 4: Activar RB-010 (procedimiento de breach LPDP)

Ver `arneses/runbooks/RB-010-lpdp-breach.md`

### Paso 5: Notificar

| Cuándo | A quién | Cómo |
|---|---|---|
| Inmediato | Equipo interno | Slack/WhatsApp/teléfono |
| <= 24h | CTO, CISO, DPO | Email + teléfono |
| <= 5 días hábiles | ANPDP (Perú) | Formulario web + email |
| <= 72h | Usuarios afectados | Email + aviso en landing |

### Paso 6: Restaurar desde backup pre-incidente

Ver Escenario 2, pero elige un backup de **al menos 7 días antes** del incidente para asegurar que el malware no estaba ya dentro.

### Paso 7: Rotar TODOS los secretos

Ver `docs/SECRET_ROTATION_CHECKLIST.md` — ejecuta el checklist completo.

### Paso 8: Auditar con refutadores

```powershell
# Ejecutar todos los verifiers contra el ambiente restaurado
Get-ChildItem tools/verifiers/verifier-*.mjs | ForEach-Object {
  Write-Host "=== $_ ===" -ForegroundColor Cyan
  node $_
}
```

### Paso 9: Post-mortem (dentro de 7 días)

- [ ] Blameless post-mortem con equipo
- [ ] Documentar timeline del incidente
- [ ] Identificar root cause
- [ ] Implementar controles preventivos
- [ ] Actualizar este runbook con lecciones aprendidas

---

## 🚨 ESCENARIO 4: Datacenter Comprometido / Outage Regional de Railway

**Síntomas**: status.railway.app muestra outage, servicios no responden, sin acceso al Dashboard.

### Paso 1: Confirmar outage externo (5 min)

```powershell
# Verificar status Railway
Invoke-WebRequest https://status.railway.app | Select-Object StatusCode
# Ver Twitter @Railway para confirmación oficial
```

### Paso 2: Si Railway confirma outage → ESPERAR

No hay nada que puedas hacer. Comunica a usuarios que el servicio está en mantenimiento.

### Paso 3: Si outage > 4 horas, considerar failover

- Railway no tiene multi-region nativo para plugins de BD
- Esto requiere plan de migración a AWS/GCP que está fuera del scope actual
- **Documentar en backlog como deuda técnica crítica**

---

## ✅ Restauración Rápida (deploy normal que salió mal)

**Síntomas**: último deploy introdujo bug, smoke tests fallan contra producción.

```powershell
# Opción A: Rollback a deploy anterior
# Railway Dashboard → servicio → Deployments → click en deploy anterior → Redeploy
# Esperar 2-3 minutos

# Opción B: Cambiar tag de imagen Docker
# En Railway Dashboard → servicio → Variables → DOCKER_IMAGE
# Cambiar brunoayala97/legalpro-node:1.4.0 → brunoayala97/legalpro-node:1.3.0
# Esperar 2-3 minutos

# Validar
curl https://legalpro-node-production.up.railway.app/api/health
```

---

## 📞 Contactos de Emergencia

| Rol | Persona | Teléfono | Email |
|---|---|---|---|
| CTO | _[LLENAR]_ | _[LLENAR]_ | _[LLENAR]_ |
| CISO | _[LLENAR]_ | _[LLENAR]_ | _[LLENAR]_ |
| DPO | _[LLENAR]_ | _[LLENAR]_ | _[LLENAR]_ |
| SRE on-call | _[LLENAR]_ | _[LLENAR]_ | _[LLENAR]_ |
| Railway Support | — | — | support@railway.app |
| ANPDP Perú | — | — | https://www.gob.pe/anpd |

## 📋 Compliance

- **LPDP Perú**: breach notification en <= 5 días hábiles
- **ISO 27001 A.16**: gestión de incidentes
- **NIST CSF**: funciones Detect (DE), Respond (RS), Recover (RC)

## 📅 Post-Incidente

- [ ] Post-mortem blameless (dentro de 7 días)
- [ ] Actualizar este runbook con lecciones aprendidas
- [ ] Implementar controles preventivos
- [ ] Test DR trimestral (simular Escenario 2 en staging)
- [ ] Documentar timeline completo para audit

---

## 📅 Log de uso del runbook

> Agregar entrada cada vez que se active este runbook en producción real.

### [YYYY-MM-DD] — _[Pendiente primer uso]_