<#
╔══════════════════════════════════════════════════════════════╗
║  LegalPro - Rotación de Secrets                             ║
║  tools/release/rotate-secrets.ps1                           ║
║  Versión: 1.0.0                                             ║
║  Próxima rotación programada: mensual (cada 30 días)        ║
╚══════════════════════════════════════════════════════════════╝

🚨 IMPORTANTE 🚨
===============
- NO ejecutar durante horas pico (9am-6pm)
- NO rotar GEMINI_API_KEY si hay usuarios activos en chat IA
- NO rotar DATABASE_URL sin verificar que no hay conexiones activas
- Rotar SOLO un secret a la vez (esperar validación entre cada uno)
- Tener Railway CLI instalado: https://docs.railway.com/develop/cli
- Tener OpenSSL instalado (Windows: usar choco install openssl o WSL)

CONTACTO DE EMERGENCIA:
  CTO: cto@legalpro.pe
  CISO: ciso@legalpro.pe
  Slack: #ops-legalpro

.DESCRIPTION
  Documentación del proceso de rotación de secrets críticos.
  NO ejecuta cambios automáticamente — es una guía paso a paso.
#>

# ═══════════════════════════════════════════════════════════════
# PRE-REQUISITOS
# ═══════════════════════════════════════════════════════════════
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  LegalPro - Rotación de Secrets                           ║" -ForegroundColor Cyan
Write-Host "║  Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔍 VERIFICACIONES PREVIAS (OBLIGATORIO):" -ForegroundColor Yellow
Write-Host "  1. Railway CLI instalado: $(if (Get-Command railway -ErrorAction SilentlyContinue) { '✅' } else { '❌' })"
Write-Host "  2. Autenticado en Railway: railway login --check"
Write-Host "  3. Slack #ops-legalpro notificado: Rotation START"
Write-Host "  4. Sentry / Datadog monitoreando"
Write-Host "  5. Smoke tests listos: node smoke-production.mjs"
Write-Host ""

Write-Host "⚠️  NO CONTINUAR hasta que los 5 checks estén verdes." -ForegroundColor Red
Write-Host ""

# ═══════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES (solo documentación)
# ═══════════════════════════════════════════════════════════════

function Show-Step {
    param([string]$Title, [string]$StepNumber)
    Write-Host ""
    Write-Host "╔══ $StepNumber. $Title ═══" -ForegroundColor Green
    Write-Host "║" -ForegroundColor Green
}

function Show-Check {
    param([string]$Check)
    Write-Host "  ☐ $Check" -ForegroundColor Yellow
}

function Show-Code {
    param([string]$Code)
    Write-Host "  >>> $Code" -ForegroundColor White
}

function Show-Warning {
    param([string]$Warning)
    Write-Host "  ⚠️  $Warning" -ForegroundColor Red
}

function Show-Note {
    param([string]$Note)
    Write-Host "  📝 $Note" -ForegroundColor Cyan
}

# ═══════════════════════════════════════════════════════════════
# SECCIÓN 1: ROTAR JWT_SECRET (+ JWT_REFRESH_SECRET)
# ═══════════════════════════════════════════════════════════════
Show-Step -Title "ROTAR JWT_SECRET" -StepNumber "1"
Write-Host "║  Afecta: legalpro-node + legalpro-dotnet" -ForegroundColor Green
Write-Host "║  Impacto: TODOS los tokens existentes se invalidan" -ForegroundColor Green
Write-Host "║  Usuarios deberán iniciar sesión nuevamente" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════" -ForegroundColor Green

Write-Host ""
Write-Host "PASO 1.1: Generar nuevo JWT_SECRET (64 caracteres base64)" -ForegroundColor White
Show-Code -Code "openssl rand -base64 48"
Show-Note -Note "El resultado debe tener al menos 48 caracteres. Copiarlo."
Write-Host ""

Write-Host "PASO 1.2: Generar nuevo JWT_REFRESH_SECRET (DIFERENTE del anterior)" -ForegroundColor White
Show-Code -Code "openssl rand -base64 48"
Show-Note -Note "DEBE ser diferente a JWT_SECRET. Copiarlo por separado."
Write-Host ""

Write-Host "PASO 1.3: Actualizar en Railway - legalpro-node" -ForegroundColor White
Show-Code -Code "railway variables set --service legalpro-node JWT_SECRET='<NUEVO_VALOR>'"
Show-Code -Code "railway variables set --service legalpro-node JWT_REFRESH_SECRET='<NUEVO_VALOR>'"
Write-Host ""

Write-Host "PASO 1.4: Actualizar en Railway - legalpro-dotnet" -ForegroundColor White
Show-Code -Code "railway variables set --service legalpro-dotnet JwtSettings__Secret='<NUEVO_VALOR>'"
Show-Code -Code "railway variables set --service legalpro-dotnet JwtSettings__RefreshSecret='<NUEVO_VALOR>'"
Show-Warning -Warning "En .NET los nombres usan doble guion bajo (__) como separador de niveles"
Write-Host ""

Write-Host "PASO 1.5: NO hacer deploy inmediato" -ForegroundColor White
Show-Note -Note "Railway aplica variables automáticamente. El servicio se reinicia."
Show-Note -Note "Todos los usuarios activos perderán su sesión."
Write-Host ""

Write-Host "PASO 1.6: Verificar" -ForegroundColor White
Show-Check -Check "railway variables get --service legalpro-node JWT_SECRET"
Show-Check -Check "curl -sf https://legalpro-node.railway.app/health"
Show-Check -Check "Probar login con credenciales válidas -> debe retornar nuevo JWT"
Show-Check -Check "Probar login con token viejo -> debe retornar 401"
Show-Check -Check "Ejecutar: node smoke-production.mjs"

Write-Host ""
Write-Host "PASO 1.7: Rollback (si algo falla)" -ForegroundColor White
Show-Code -Code "# Restaurar valor ANTERIOR del backup"
Show-Code -Code "railway variables set --service legalpro-node JWT_SECRET='<VALOR_ANTERIOR>'"
Show-Code -Code "railway variables set --service legalpro-dotnet JwtSettings__Secret='<VALOR_ANTERIOR>'"

# ═══════════════════════════════════════════════════════════════
# SECCIÓN 2: ROTAR GEMINI_API_KEY
# ═══════════════════════════════════════════════════════════════
Show-Step -Title "ROTAR GEMINI_API_KEY" -StepNumber "2"
Write-Host "║  Afecta: legalpro-node + legalpro-dotnet" -ForegroundColor Green
Write-Host "║  Impacto: Funcionalidades IA interrumpidas hasta completar" -ForegroundColor Green
Write-Host "║  Ventana recomendada: 2am - 4am (mínimo uso)" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════" -ForegroundColor Green

Write-Host ""
Write-Host "PASO 2.1: Generar nueva API Key en Google AI Studio" -ForegroundColor White
Show-Note -Note "Ir a: https://aistudio.google.com/app/apikey"
Show-Check -Check "Iniciar sesión con cuenta corporativa legalpro.pe"
Show-Check -Check "Crear nueva API Key -> Copiar valor completo"
Show-Check -Check "NO eliminar la key VIEJA hasta verificar que la nueva funciona"
Write-Host ""

Write-Host "PASO 2.2: Verificar la nueva API Key funciona" -ForegroundColor White
Show-Code -Code "curl -sf 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=<NUEVA_KEY>' -H 'Content-Type: application/json' -d '{\"contents\":[{\"parts\":[{\"text\":\"Hola, responde OK\"}]}]}'"
Show-Note -Note "Debe retornar una respuesta válida (status 200). Si retorna 403/429 revisar cuotas."
Write-Host ""

Write-Host "PASO 2.3: Actualizar en Railway - legalpro-node" -ForegroundColor White
Show-Code -Code "railway variables set --service legalpro-node GEMINI_API_KEY='<NUEVA_KEY>'"
Write-Host ""

Write-Host "PASO 2.4: Actualizar en Railway - legalpro-dotnet" -ForegroundColor White
Show-Code -Code "railway variables set --service legalpro-dotnet Gemini__ApiKey='<NUEVA_KEY>'"
Write-Host ""

Write-Host "PASO 2.5: Verificar" -ForegroundColor White
Show-Check -Check "curl -sf https://legalpro-node.railway.app/health/deep -> gemini: 'ok'"
Show-Check -Check "curl -sf https://legalpro-node.railway.app/api/gemini/generate con prompt de prueba"
Show-Check -Check "Ejecutar: node smoke-production.mjs"
Show-Check -Check "Verificar en Google AI Studio que la key nueva tiene actividad"
Write-Host ""

Write-Host "PASO 2.6: Post-rotación" -ForegroundColor White
Show-Note -Note "Esperar 24h para confirmar que la key nueva funciona sin issues"
Show-Note -Note "SOLO entonces eliminar la key VIEJA de Google AI Studio"
Write-Host ""

Write-Host "PASO 2.7: Rollback (si la key nueva falla)" -ForegroundColor White
Show-Code -Code "railway variables set --service legalpro-node GEMINI_API_KEY='<KEY_VIEJA>'"
Show-Code -Code "railway variables set --service legalpro-dotnet Gemini__ApiKey='<KEY_VIEJA>'"

# ═══════════════════════════════════════════════════════════════
# SECCIÓN 3: ROTAR DATABASE_URL (PostgreSQL)
# ═══════════════════════════════════════════════════════════════
Show-Step -Title "ROTAR DATABASE_URL (PostgreSQL)" -StepNumber "3"
Write-Host "║  ⚠️  SECRET DE MÁXIMO IMPACTO" -ForegroundColor Red
Write-Host "║  Afecta: TODOS los servicios (node + dotnet + owner)" -ForegroundColor Green
Write-Host "║  Impacto: Interrupción TOTAL del servicio si se hace mal" -ForegroundColor Green
Write-Host "║  Ventana: 2am - 3am (mantenimiento programado)" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════" -ForegroundColor Green

Write-Host ""
Write-Host "PASO 3.1: Generar nueva contraseña de PostgreSQL" -ForegroundColor White
Show-Note -Note "Railway maneja la rotación de DATABASE_URL via Reset Password en el dashboard."
Show-Note -Note "NO cambiar manualmente — usar el botón 'Reset Password' de Railway."
Show-Code -Code "# Railway Dashboard -> PostgreSQL plugin -> Settings -> Reset Password"
Show-Note -Note "Alternativa: Usar Railway CLI para regenerar"
Show-Code -Code "railway connect postgres --reset-password"
Write-Host ""

Write-Host "PASO 3.2: La nueva DATABASE_URL se genera automáticamente" -ForegroundColor White
Show-Note -Note "Railway actualiza ${{Postgres.DATABASE_URL}} automáticamente."
Show-Note -Note "Los servicios referencian DATABASE_URL como variable referenciada."
Show-Code -Code "railway variables get --service legalpro-node DATABASE_URL"
Write-Host ""

Write-Host "PASO 3.3: Verificar conectividad ()" -ForegroundColor White
Show-Code -Code "railway run --service legalpro-node 'node -e \"const { Pool } = require(\\\"pg\\\"); const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); p.query(\\\"SELECT 1 AS ok\\\").then(r => { console.log(\\\"DB OK:\\\", r.rows[0].ok); process.exit(0); }).catch(e => { console.error(\\\"DB FAIL:\\\", e.message); process.exit(1); });\"'"
Show-Check -Check "curl -sf https://legalpro-node.railway.app/health/readiness -> status: 'ok'"
Show-Check -Check "curl -sf https://legalpro-dotnet.railway.app/health"
Show-Check -Check "Probar operaciones CRUD básicas (crear usuario, consultar expedientes)"
Show-Check -Check "Ejecutar: node smoke-production.mjs"
Write-Host ""

Write-Host "PASO 3.4: Si la rotación fue por breach de seguridad" -ForegroundColor White
Show-Note -Note "Además de rotar DATABASE_URL:"
Show-Check -Check "Rotar TODOS los secrets (JWT, Gemini, Supabase, Owner)"
Show-Check -Check "Revisar logs de acceso a PostgreSQL (Railway Audit Logs)"
Show-Check -Check "Notificar a CISO: ciso@legalpro.pe"
Show-Check -Check "Documentar incidente en #ops-legalpro"

Write-Host ""
Write-Host "PASO 3.5: Rollback (extremadamente difícil)" -ForegroundColor White
Show-Warning -Warning "Railway NO permite recuperar la contraseña anterior."
Show-Warning -Warning "Si se pierde conectividad: restaurar desde backup."
Show-Code -Code "# 1. Ir a Railway Dashboard -> PostgreSQL -> Backups"
Show-Code -Code "# 2. Restaurar backup pre-rotación"
Show-Code -Code "# 3. Verificar: curl -sf https://legalpro-node.railway.app/health/readiness"

# ═══════════════════════════════════════════════════════════════
# VERIFICACIÓN POST-ROTACIÓN COMPLETA
# ═══════════════════════════════════════════════════════════════
Show-Step -Title "VERIFICACIÓN POST-ROTACIÓN (OBLIGATORIO)" -StepNumber "4"
Write-Host "║  Ejecutar SOLO después de rotar TODOS los secrets planeados" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════" -ForegroundColor Green

Write-Host ""
Write-Host "4.1 Health checks de todos los servicios:" -ForegroundColor White
Show-Check -Check "curl -sf https://legalpro-node.railway.app/health"
Show-Check -Check "curl -sf https://legalpro-node.railway.app/health/readiness"
Show-Check -Check "curl -sf https://legalpro-node.railway.app/health/deep"
Show-Check -Check "curl -sf https://legalpro-dotnet.railway.app/health"
Show-Check -Check "curl -sf https://legalpro.pe/health"
Write-Host ""

Write-Host "4.2 Smoke tests:" -ForegroundColor White
Show-Check -Check "node smoke-production.mjs -> OK"
Show-Check -Check "npm test -> Passing mínimo 80%"
Write-Host ""

Write-Host "4.3 Verificar que usuarios pueden hacer login:" -ForegroundColor White
Show-Check -Check "Login con ABOGADO -> obtiene JWT"
Show-Check -Check "Login con FISCAL -> obtiene JWT"
Show-Check -Check "Login con JUEZ -> obtiene JWT"
Show-Check -Check "Login con CONTADOR -> obtiene JWT"
Show-Check -Check "Login con credenciales inválidas -> 401"
Write-Host ""

Write-Host "4.4 Verificar Gemini responde:" -ForegroundColor White
Show-Check -Check "POST /api/gemini/generate con prompt 'Hola' -> 200"
Show-Check -Check "POST /api/ai/legal con consulta legal -> 200"
Write-Host ""

Write-Host "4.5 Monitoreo post-rotación (siguientes 24h):" -ForegroundColor White
Show-Check -Check "Sentry: sin spikes de error 401/403/500"
Show-Check -Check "Railway: sin reinicios inesperados"
Show-Check -Check "Slack #ops-legalpro: sin alertas"
Show-Check -Check "Gemini quota: sin incremento anormal de 429"

# ═══════════════════════════════════════════════════════════════
# SECCIÓN 5: LOG DE ROTACIÓN
# ═══════════════════════════════════════════════════════════════
Show-Step -Title "REGISTRAR ROTACIÓN EN LOG" -StepNumber "5"
Write-Host "║  Documentar cada rotación para cumplimiento y auditoría" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════" -ForegroundColor Green

Write-Host ""
Write-Host "Crear entrada en docs/rotation-log.md con:" -ForegroundColor White
Show-Code -Code "## $(Get-Date -Format 'yyyy-MM-dd') - Rotación de Secrets"
Show-Code -Code ""
Show-Code -Code "| Secret | Servicio | Rotado por | Estado |"
Show-Code -Code "|--------|----------|------------|--------|"
Show-Code -Code "| JWT_SECRET | node + dotnet | @devops | ✅ OK |"
Show-Code -Code "| GEMINI_API_KEY | node + dotnet | @devops | ✅ OK |"
Show-Code -Code "| DATABASE_URL | node + dotnet + owner | Railway | ✅ OK |"
Show-Code -Code ""
Show-Code -Code "Tiempo total: XX minutos"
Show-Code -Code "Incidencias: Ninguna"
Show-Code -Code "Próxima rotación programada: $(Get-Date (Get-Date).AddMonths(1) -Format 'yyyy-MM-dd')"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✅ FIN DEL PROCESO DE ROTACIÓN                             ║" -ForegroundColor Cyan
Write-Host "║  Recordatorio: próxima rotación en 30 días                  ║" -ForegroundColor Cyan
Write-Host "║  Notificar en Slack #ops-legalpro: Rotation COMPLETE        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
