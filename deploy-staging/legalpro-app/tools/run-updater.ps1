# legalpro-app/tools/run-updater.ps1
# LegalPro — Ejecutor del Actualizador de Catálogos Legales
#
# Uso:
#   .\run-updater.ps1                    # ejecución única (modo once)
#   .\run-updater.ps1 -Mode once         # ejecución única
#   .\run-updater.ps1 -Mode daily        # ejecuta y repite cada 24h
#   .\run-updater.ps1 -Mode weekly       # ejecuta y repite cada 7 días
#   .\run-updater.ps1 -Mode once -Verbose # salida detallada
#   .\run-updater.ps1 -Mode once -Fix    # intenta corregir errores menores
#
# Requisitos:
#   - Node.js 20+
#   - Ejecutar desde la raíz del proyecto legalpro-app/ o tools/

param(
    [ValidateSet('once', 'daily', 'weekly')]
    [string]$Mode = 'once',

    [switch]$Verbose,

    [switch]$Fix
)

# ── Configuración ──────────────────────────────────────────────────────────────

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\..\.."  # tools/ → raíz del proyecto
$UpdaterScript = Resolve-Path "$ScriptDir\legal-catalog-updater.mjs"

# ── Función: Ejecutar updater ──────────────────────────────────────────────────

function Invoke-Updater {
    Write-Host "[updater] Iniciando actualización de catálogos legales..." -ForegroundColor Cyan
    $start = Get-Date

    # Construir argumentos
    $argsList = @()
    if ($Verbose) { $argsList += '--verbose' }
    if ($Fix) { $argsList += '--fix' }

    # Cambiar al directorio raíz del proyecto (necesario para rutas relativas)
    Push-Location $ProjectRoot

    try {
        $result = & "node" $UpdaterScript $argsList 2>&1
        $exitCode = $LASTEXITCODE

        $duration = (Get-Date) - $start
        $durationMs = [math]::Round($duration.TotalMilliseconds)

        # Mostrar resultado
        foreach ($line in $result) {
            Write-Host $line
        }

        if ($exitCode -eq 0) {
            Write-Host "[updater] ✅ Catálogos actualizados en $durationMs ms" -ForegroundColor Green
        } else {
            Write-Host "[updater] ❌ Error actualizando catálogos (exit code: $exitCode)" -ForegroundColor Red
        }

        return $exitCode -eq 0
    } catch {
        $duration = (Get-Date) - $start
        Write-Host "[updater] ❌ Error: $_" -ForegroundColor Red
        return $false
    } finally {
        Pop-Location
    }
}

# ── Modos de ejecución ─────────────────────────────────────────────────────────

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  LegalPro — Actualizador de Catálogos   " -ForegroundColor Magenta
Write-Host "  Modo: $Mode" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

switch ($Mode) {
    'once' {
        $ok = Invoke-Updater
        exit $(if ($ok) { 0 } else { 1 })
    }

    'daily' {
        Write-Host "[updater] Modo diario: ejecutando cada 24 horas" -ForegroundColor Yellow
        do {
            $ok = Invoke-Updater
            if (-not $ok) {
                Write-Host "[updater] ⚠️  La actualización tuvo errores. Reintentando en 1 hora..." -ForegroundColor Yellow
                Start-Sleep -Seconds 3600
            } else {
                Write-Host "[updater] ⏰ Próxima ejecución en 24 horas..." -ForegroundColor Cyan
                Start-Sleep -Seconds 86400
            }
        } while ($true)
    }

    'weekly' {
        Write-Host "[updater] Modo semanal: ejecutando cada 7 días" -ForegroundColor Yellow
        do {
            $ok = Invoke-Updater
            Write-Host "[updater] ⏰ Próxima ejecución en 7 días..." -ForegroundColor Cyan
            Start-Sleep -Seconds 604800
        } while ($true)
    }
}
