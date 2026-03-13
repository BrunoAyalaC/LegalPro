# Skill: Crear Pantalla Android (Jetpack Compose)

## Cuándo usar

Cuando necesites crear una nueva pantalla/screen en la app Android nativa (cliente principal de LegalPro).

## Flujo de Trabajo

### 1. Definir la pantalla

- Nombre y propósito
- Rol de usuario (ABOGADO, FISCAL, JUEZ, CONTADOR)
- Datos que consume (via Retrofit → Backend Railway → Supabase)
- Interacciones de usuario

### 2. Crear los archivos

```
com/legalpro/app/
├── data/
│   ├── api/NuevoApi.kt              → Retrofit interface
│   └── repository/NuevoRepository.kt → Repository
├── domain/
│   └── usecase/GetNuevoUseCase.kt   → Use case
└── presentation/
    ├── screens/NuevoScreen.kt        → Composable screen
    └── viewmodel/NuevoViewModel.kt   → ViewModel
```

### 3. Retrofit API Interface

```kotlin
interface NuevoApi {
    @GET("api/v1/recurso")
    suspend fun getRecursos(@Header("Authorization") token: String): Response<ApiResponse<List<Recurso>>>

    @POST("api/v1/recurso")
    suspend fun createRecurso(@Header("Authorization") token: String, @Body body: CreateRecursoRequest): Response<ApiResponse<Recurso>>
}
```

### 4. ViewModel con StateFlow

```kotlin
@HiltViewModel
class NuevoViewModel @Inject constructor(
    private val repository: NuevoRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState<List<Recurso>>>(UiState.Loading)
    val uiState: StateFlow<UiState<List<Recurso>>> = _uiState.asStateFlow()

    init { loadData() }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            repository.getRecursos()
                .onSuccess { _uiState.value = UiState.Success(it) }
                .onFailure { _uiState.value = UiState.Error(it.message ?: "Error") }
        }
    }
}

sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}
```

### 5. Composable Screen

```kotlin
@Composable
fun NuevoScreen(
    viewModel: NuevoViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(topBar = { /* TopAppBar */ }) { padding ->
        when (val state = uiState) {
            is UiState.Loading -> CircularProgressIndicator()
            is UiState.Success -> NuevoContent(state.data)
            is UiState.Error -> ErrorMessage(state.message)
        }
    }
}
```

### 6. Registrar en NavGraph

```kotlin
composable("nuevo_screen") {
    NuevoScreen(onNavigateBack = { navController.popBackStack() })
}
```

### 7. Checklist

- [ ] Screen creada con Jetpack Compose (NO XML)
- [ ] ViewModel con Hilt (`@HiltViewModel`)
- [ ] StateFlow para UI state (Loading/Success/Error)
- [ ] Retrofit interface para API calls → Backend Railway
- [ ] Repository para data layer
- [ ] Registrada en NavGraph
- [ ] UI en español, código en inglés
