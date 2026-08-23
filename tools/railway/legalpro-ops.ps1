#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Railway ops mínimo — redeploy y logs (sin sandboxes, sin costo extra).

.PREREQUISITO (una vez):
  railway login
  cd repo-root && railway link    # elegir proyecto LegalPro

.USO:
  .\tools\railway\legalpro-ops.ps1 status
  .\tools\railway\legalpro-ops.ps1 logs -Service legalpro-node -Lines 80
  .\tools\railway\legalpro-ops.ps1 logs -Service legalpro-dotnet -Lines 50
  .\tools\railway\legalpro-ops.ps1 logs -Service Postgres -Lines 30
  .\tools\railway\legalpro-ops.ps1 logs-all -Lines 40
  .\tools\railway\legalpro-ops.ps1 logs -Service legalpro-node -Follow -Filter "@level:error"
  .\tools\railway\legalpro-ops.ps1 connect-db
  .\tools\railway\legalpro-ops.ps1 redeploy -Service legalpro-frontend
  .\tools\railway\legalpro-ops.ps1 redeploy-all
  .\tools\railway\legalpro-ops.ps1 set-image -Service legalpro-node -Tag 6.3.6

  # Token CI (opcional, sin browser):
  $env:RAILWAY_TOKEN = "..." ; .\tools\railway\legalpro-ops.ps1 status
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('login', 'status', 'logs', 'logs-all', 'redeploy', 'redeploy-all', 'set-image', 'open', 'connect-db')]
  [string]$Action = 'status',

  [ValidateSet('legalpro-frontend', 'legalpro-node', 'legalpro-dotnet', 'Postgres', 'all')]
  [string]$Service = 'legalpro-node',

  [string]$Tag = '',
  [string]$Filter = '',
  [int]$Lines = 100,
  [switch]$Follow,
  [switch]$Build,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

function Assert-Railway {
  if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Error 'Railway CLI no instalado. Instala: npm i -g @railway/cli o winget install Railway.Railway'
  }
}

function Assert-Auth {
  railway whoami 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'No autenticado. Ejecuta: railway login' -ForegroundColor Yellow
    Write-Host 'O define RAILWAY_TOKEN (Project Token en Railway → Project Settings → Tokens)' -ForegroundColor Yellow
    exit 1
  }
}

function Get-DockerImageBase {
  param([string]$Name)
  switch ($Name) {
    'legalpro-frontend' { 'brunoayala97/legalpro-frontend' }
    'legalpro-node'     { 'brunoayala97/legalpro-node' }
    'legalpro-dotnet'   { 'brunoayala97/legalpro-dotnet' }
    default { throw "Servicio desconocido: $Name" }
  }
}

Push-Location $RepoRoot
try {
  Assert-Railway

  switch ($Action) {
    'login' {
      railway login
      if (-not (Test-Path '.railway')) {
        Write-Host "`nSiguiente paso: railway link (elegir proyecto LegalPro)" -ForegroundColor Cyan
      }
    }

    'open' {
      Assert-Auth
      railway open
    }

    'status' {
      Assert-Auth
      Write-Host "=== Railway whoami ===" -ForegroundColor Cyan
      railway whoami
      Write-Host "`n=== Proyecto enlazado ===" -ForegroundColor Cyan
      railway status
      Write-Host "`nServicios LegalPRO:" -ForegroundColor Cyan
      Write-Host "  legalpro-node     → API Node (auth, chat, expedientes)"
      Write-Host "  legalpro-frontend → React/nginx"
      Write-Host "  legalpro-dotnet   → API .NET"
      Write-Host "  Postgres          → Base de datos"
    }

    'logs' {
      Assert-Auth
      if ($Service -eq 'all') { & $PSCommandPath logs-all -Lines $Lines -Follow:$Follow -Build:$Build -Filter $Filter; return }
      $railwayArgs = @('logs', '-s', $Service, '-n', "$Lines")
      if ($Follow) { $railwayArgs += '--follow'; $railwayArgs = $railwayArgs | Where-Object { $_ -ne '-n' -and $_ -ne "$Lines" } }
      if ($Build) { $railwayArgs += '-b' } else { $railwayArgs += '-d' }
      if ($Filter) { $railwayArgs += @('-f', $Filter) }
      Write-Host "`n========== $Service ==========" -ForegroundColor Cyan
      Write-Host "Deploy logs$(if ($Filter) { " | filter: $Filter" })$(if ($Follow) { ' | LIVE' })" -ForegroundColor DarkGray
      & railway @railwayArgs
    }

    'logs-all' {
      Assert-Auth
      $services = @(
        @{ Name = 'legalpro-node';     Desc = 'Node API' },
        @{ Name = 'legalpro-frontend'; Desc = 'Frontend' },
        @{ Name = 'legalpro-dotnet';   Desc = '.NET API' },
        @{ Name = 'Postgres';          Desc = 'PostgreSQL' }
      )
      foreach ($svc in $services) {
        Write-Host "`n" + ('=' * 60) -ForegroundColor DarkGray
        Write-Host " $($svc.Desc) ($($svc.Name)) — últimas $Lines líneas" -ForegroundColor Cyan
        Write-Host ('=' * 60) -ForegroundColor DarkGray
        $railwayArgs = @('logs', '-s', $svc.Name, '-n', "$Lines", '-d')
        if ($Filter) { $railwayArgs += @('-f', $Filter) }
        & railway @railwayArgs
        if ($LASTEXITCODE -ne 0) {
          Write-Host "(sin logs o servicio no encontrado: $($svc.Name))" -ForegroundColor Yellow
        }
      }
    }

    'connect-db' {
      Assert-Auth
      Write-Host 'Abriendo psql a Postgres (Railway)...' -ForegroundColor Cyan
      railway connect Postgres
    }

    'redeploy' {
      Assert-Auth
      if ($Service -eq 'all') { & $PSCommandPath redeploy-all -Yes:$Yes; return }
      $confirm = $Yes.IsPresent
      if (-not $confirm) {
        $r = Read-Host "Redeploy $Service en producción? (s/N)"
        $confirm = $r -match '^[sSyY]'
      }
      if (-not $confirm) { Write-Host 'Cancelado.'; return }
      Write-Host "Redeploy: $Service" -ForegroundColor Cyan
      railway redeploy -s $Service -y
    }

    'redeploy-all' {
      Assert-Auth
      $services = @('legalpro-node', 'legalpro-frontend', 'legalpro-dotnet')
      foreach ($svc in $services) {
        Write-Host "`n--- Redeploy $svc ---" -ForegroundColor Cyan
        railway redeploy -s $svc -y
      }
    }

    'set-image' {
      Assert-Auth
      if (-not $Tag) { throw 'Usa -Tag 6.3.7 (versión Docker Hub)' }
      if ($Service -eq 'all') {
        foreach ($svc in @('legalpro-node', 'legalpro-frontend', 'legalpro-dotnet')) {
          $img = "$(Get-DockerImageBase $svc):$Tag"
          Write-Host "Variable RAILWAY_DOCKER_IMAGE=$img en $svc" -ForegroundColor Cyan
          railway variable set "RAILWAY_DOCKER_IMAGE=$img" -s $svc
          railway redeploy -s $svc -y
        }
      } else {
        $img = "$(Get-DockerImageBase $Service):$Tag"
        Write-Host "RAILWAY_DOCKER_IMAGE=$img en $Service" -ForegroundColor Cyan
        railway variable set "RAILWAY_DOCKER_IMAGE=$img" -s $Service
        railway redeploy -s $Service -y
      }
    }
  }
} finally {
  Pop-Location
}
