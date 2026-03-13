---
description: "Reglas para componentes Android Kotlin/Compose en LegalPro. La app Android es el cliente principal."
applyTo: "LegalProAndroid/**/*.kt"
---

# Android Compose - Reglas

## Arquitectura

- **MVVM estricto**: Screen → ViewModel → Repository → API/DB
- **Hilt** para toda inyección de dependencias
- **Coroutines + Flow** para asincronía
- **Jetpack Compose** para toda la UI — NO XML layouts

## Patrones obligatorios

### Sealed class para UI state

```kotlin
sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}
```

### ViewModel con Hilt

```kotlin
@HiltViewModel
class XViewModel @Inject constructor(private val repo: XRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<UiState<X>>(UiState.Loading)
    val uiState = _uiState.asStateFlow()
}
```

### Screen composable

```kotlin
@Composable
fun XScreen(viewModel: XViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    // Render basado en state
}
```

## Conectividad

- **Retrofit** para API calls → Backend en Railway (HTTPS)
- **Supabase Android SDK** para auth directo y realtime
- NUNCA hardcodear URLs de backend

## Convenciones

- UI en español, código en inglés
- `viewModelScope` para coroutines en ViewModels
- NO `GlobalScope`, NO network calls en composables
- SIEMPRE manejar Loading/Success/Error states
