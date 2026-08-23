---
description: Reglas para código Android Kotlin/Compose en LegalPro
globs:
  - "LegalProAndroid/**/*.kt"
  - "LegalProAndroid/**/*.kts"
---

# Reglas Android Kotlin/Compose

Aplicar estas reglas al editar archivos Kotlin/Compose en `LegalProAndroid/`.

## Arquitectura

- **MVVM estricto**: View → ViewModel → Repository → DataSource
- **Hilt** para inyección de dependencias
- **Jetpack Compose** (NO XML layouts)
- **Coroutines + Flow** (NO GlobalScope)
- **Compose State**: sealed `UiState` con Loading/Success/Error/Empty

## Networking

- **Retrofit + OkHttp + Gson** contra `legalpro-dotnet` y `legalpro-node`
- **Interceptor automático**: `Authorization: Bearer <jwt>` + `X-Correlation-ID` (UUID)

## Persistencia

- **Room** para cache local (DAOs: `EscritoDao`, `ExpedienteDao`)
- **EncryptedSharedPreferences** para JWT
- NUNCA SharedPreferences plano

## Concurrencia

- `viewModelScope` para operaciones de ViewModel
- `lifecycleScope` para Compose
- NUNCA network en composables

## Calidad

- Tests Compose UI por cada screen
- Tests JUnit para ViewModels
- R8 + ProGuard para release
- KSP para procesamiento de anotaciones
