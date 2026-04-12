package com.legalpro.app.presentation.tools

import app.cash.turbine.test
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

// ─────────────────────────────────────────────────────────────────────────────
// Contrato MVI local — usado mientras BuscadorJurisprudenciaViewModel no existe en prod
// ─────────────────────────────────────────────────────────────────────────────

/** Filtros opcionales para la búsqueda de jurisprudencia */
data class FiltrosJurisprudencia(
    val materia: String? = null,
    val anio: Int? = null,
    val sala: String? = null
)

/** Resultado de una búsqueda de jurisprudencia */
data class ResultadoJurisprudencia(
    val id: String,
    val titulo: String,
    val resumen: String,
    val fechaPublicacion: String,
    val materia: String,
    val tribunal: String
)

/** Respuesta paginada del repositorio */
data class BusquedaResponse(
    val resultados: List<ResultadoJurisprudencia>,
    val total: Int
)

/** Estado observable del buscador */
data class BuscadorState(
    val query: String = "",
    val isLoading: Boolean = false,
    val resultados: List<ResultadoJurisprudencia> = emptyList(),
    val totalResultados: Int = 0,
    val error: String? = null
)

/** Eventos que el usuario puede disparar */
sealed class BuscadorEvent {
    data class BuscarJurisprudencia(
        val query: String,
        val filtros: FiltrosJurisprudencia = FiltrosJurisprudencia()
    ) : BuscadorEvent()

    object LimpiarBusqueda : BuscadorEvent()
    data class SeleccionarResultado(val id: String) : BuscadorEvent()
}

/** Efectos de un solo disparo */
sealed class BuscadorEffect {
    data class NavToDetalle(val id: String) : BuscadorEffect()
    data class ShowError(val msg: String) : BuscadorEffect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaz del repositorio (stub para tests)
// ─────────────────────────────────────────────────────────────────────────────

interface JurisprudenciaRepository {
    suspend fun buscar(query: String, filtros: FiltrosJurisprudencia): Result<BusquedaResponse>
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewModel hipotético sujeto bajo prueba
// ─────────────────────────────────────────────────────────────────────────────

class BuscadorJurisprudenciaViewModelStub(
    private val repository: JurisprudenciaRepository
) {
    private val _state = MutableStateFlow(BuscadorState())
    val state: StateFlow<BuscadorState> = _state.asStateFlow()

    private val _effect = MutableSharedFlow<BuscadorEffect>(extraBufferCapacity = 8)
    val effect: SharedFlow<BuscadorEffect> = _effect.asSharedFlow()

    suspend fun onEvent(event: BuscadorEvent) {
        when (event) {
            is BuscadorEvent.BuscarJurisprudencia -> buscar(event.query, event.filtros)
            BuscadorEvent.LimpiarBusqueda         -> limpiar()
            is BuscadorEvent.SeleccionarResultado -> seleccionar(event.id)
        }
    }

    private suspend fun buscar(query: String, filtros: FiltrosJurisprudencia) {
        // Validación: query no puede estar vacío
        if (query.isBlank()) {
            _state.value = _state.value.copy(
                error = "El campo de búsqueda no puede estar vacío"
            )
            return
        }

        _state.value = _state.value.copy(isLoading = true, error = null, query = query)

        repository.buscar(query, filtros).fold(
            onSuccess = { response ->
                _state.value = _state.value.copy(
                    isLoading = false,
                    resultados = response.resultados,
                    totalResultados = response.total
                )
            },
            onFailure = { ex ->
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = ex.message ?: "Error de red"
                )
                _effect.emit(BuscadorEffect.ShowError(ex.message ?: "Error de red"))
            }
        )
    }

    private fun limpiar() {
        _state.value = BuscadorState()
    }

    private suspend fun seleccionar(id: String) {
        _effect.emit(BuscadorEffect.NavToDetalle(id))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY TESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JOURNEY TESTS — BuscadorJurisprudenciaViewModel
 * Cubre: validación de query, búsquedas exitosas, sin resultados,
 * errores de red, navegación al detalle y limpieza de búsqueda.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class BuscadorJurisprudenciaViewModelJourneyTest {

    private val repository: JurisprudenciaRepository = mockk()
    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() { Dispatchers.setMain(testDispatcher) }

    @After
    fun tearDown() { Dispatchers.resetMain() }

    private fun vm() = BuscadorJurisprudenciaViewModelStub(repository)

    // ─── Journey 1: Búsqueda con query vacío → validación ─────────

    @Test
    fun `journey_busqueda_con_query_vacio_no_llama_a_la_api`() = runTest {
        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = ""))

        // El repositorio NO debe ser llamado
        coVerify(exactly = 0) { repository.buscar(any(), any()) }
    }

    @Test
    fun `journey_busqueda_con_query_vacio_muestra_error_validacion`() = runTest {
        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = ""))

        val state = viewModel.state.value
        assertNotNull("Debe haber error de validación", state.error)
        assertTrue("El error debe mencionar el campo", state.error!!.contains("búsqueda"))
        assertFalse("No debe estar cargando", state.isLoading)
    }

    @Test
    fun `journey_busqueda_con_solo_espacios_no_llama_api`() = runTest {
        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = "   "))

        coVerify(exactly = 0) { repository.buscar(any(), any()) }
        assertNotNull(viewModel.state.value.error)
    }

    // ─── Journey 2: Búsqueda exitosa → isLoading flips, resultados ─

    @Test
    fun `journey_busqueda_exitosa_carga_resultados_en_estado`() = runTest {
        val resultados = listOf(
            ResultadoJurisprudencia(
                id = "cas-1234-2023",
                titulo = "Casación 1234-2023 Lima",
                resumen = "Despido arbitrario sin expresión de causa",
                fechaPublicacion = "15/03/2023",
                materia = "LABORAL",
                tribunal = "Sala Laboral Permanente"
            ),
            ResultadoJurisprudencia(
                id = "cas-5678-2023",
                titulo = "Casación 5678-2023 Arequipa",
                resumen = "Reposición laboral por nulidad de despido",
                fechaPublicacion = "22/06/2023",
                materia = "LABORAL",
                tribunal = "Sala Civil Transitoria"
            )
        )
        coEvery { repository.buscar("despido arbitrario", any()) } returns
                Result.success(BusquedaResponse(resultados = resultados, total = 2))

        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = "despido arbitrario"))

        val state = viewModel.state.value
        assertFalse("isLoading debe ser false tras respuesta", state.isLoading)
        assertEquals("Debe haber 2 resultados", 2, state.resultados.size)
        assertEquals("Total debe ser 2", 2, state.totalResultados)
        assertNull("No debe haber error", state.error)
    }

    @Test
    fun `journey_busqueda_exitosa_actualiza_query_en_estado`() = runTest {
        coEvery { repository.buscar("recurso de casación", any()) } returns
                Result.success(BusquedaResponse(resultados = emptyList(), total = 0))

        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = "recurso de casación"))

        assertEquals("El query debe persistir en el estado", "recurso de casación", viewModel.state.value.query)
    }

    // ─── Journey 3: Búsqueda sin resultados → lista vacía, sin error ─

    @Test
    fun `journey_busqueda_sin_resultados_retorna_lista_vacia_sin_error`() = runTest {
        coEvery { repository.buscar("jurisprudencia_inexistente_xyz", any()) } returns
                Result.success(BusquedaResponse(resultados = emptyList(), total = 0))

        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = "jurisprudencia_inexistente_xyz"))

        val state = viewModel.state.value
        assertTrue("Lista debe estar vacía", state.resultados.isEmpty())
        assertEquals("Total debe ser 0", 0, state.totalResultados)
        assertNull("No debe haber error cuando no hay resultados", state.error)
        assertFalse("No debe estar cargando", state.isLoading)
    }

    // ─── Journey 4: Error de red → error en estado ────────────────

    @Test
    fun `journey_error_de_red_muestra_error_en_estado`() = runTest {
        coEvery { repository.buscar(any(), any()) } returns
                Result.failure(Exception("No hay conexión a internet"))

        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = "habeas corpus"))

        val state = viewModel.state.value
        assertFalse("isLoading debe ser false", state.isLoading)
        assertNotNull("Debe haber error en el estado", state.error)
        assertTrue(state.error!!.contains("conexión"))
        assertTrue("Resultados deben estar vacíos ante error", state.resultados.isEmpty())
    }

    @Test
    fun `journey_error_de_red_emite_efecto_ShowError`() = runTest {
        coEvery { repository.buscar(any(), any()) } returns
                Result.failure(Exception("Servidor no disponible"))

        val viewModel = vm()
        viewModel.effect.test {
            viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = "amparo constitucional"))
            val effect = awaitItem()
            assertTrue("Debe emitir ShowError", effect is BuscadorEffect.ShowError)
            assertTrue((effect as BuscadorEffect.ShowError).msg.contains("Servidor"))
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── Journey 5: Seleccionar resultado → NavigateToDetalle ─────

    @Test
    fun `journey_seleccionar_resultado_emite_NavToDetalle_con_id_correcto`() = runTest {
        val viewModel = vm()
        viewModel.effect.test {
            viewModel.onEvent(BuscadorEvent.SeleccionarResultado(id = "cas-9876-2024"))
            val effect = awaitItem()
            assertTrue("Debe emitir NavToDetalle", effect is BuscadorEffect.NavToDetalle)
            assertEquals("El id debe coincidir", "cas-9876-2024", (effect as BuscadorEffect.NavToDetalle).id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `journey_seleccionar_diferente_resultado_emite_id_correcto`() = runTest {
        val viewModel = vm()
        viewModel.effect.test {
            viewModel.onEvent(BuscadorEvent.SeleccionarResultado(id = "exp-lima-2025-00123"))
            val effect = awaitItem()
            assertEquals("exp-lima-2025-00123", (effect as BuscadorEffect.NavToDetalle).id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── Journey 6: Limpiar búsqueda resetea el estado ────────────

    @Test
    fun `journey_limpiar_busqueda_resetea_estado_completamente`() = runTest {
        val resultados = listOf(
            ResultadoJurisprudencia("r1", "Casación X", "Resumen", "01/01/2024", "CIVIL", "Sala Civil")
        )
        coEvery { repository.buscar(any(), any()) } returns
                Result.success(BusquedaResponse(resultados = resultados, total = 1))

        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = "nulidad de acto jurídico"))

        // Verificar que hay datos
        assertEquals(1, viewModel.state.value.resultados.size)

        // Limpiar
        viewModel.onEvent(BuscadorEvent.LimpiarBusqueda)

        val state = viewModel.state.value
        assertEquals("Query debe estar vacío", "", state.query)
        assertTrue("Resultados deben estar vacíos", state.resultados.isEmpty())
        assertEquals("Total debe ser 0", 0, state.totalResultados)
        assertNull("Error debe ser null", state.error)
        assertFalse("isLoading debe ser false", state.isLoading)
    }

    // ─── Journey 7: Query con caracteres especiales no crashea ────

    @Test
    fun `journey_query_con_caracteres_especiales_no_lanza_excepcion`() = runTest {
        // Caracteres especiales del español y jurídicos peruanos
        val queriesEspeciales = listOf(
            "nulidad (art. 140° CC)",
            "prescripción & caducidad",
            "Código Procesal Civil art. 427°",
            "título habilitante – SUNARP",
            "\"despido nulo\" OR \"reposición\"",
            "casación: 1234-2020/Lima",
            "indemnización > S/. 50,000"
        )

        coEvery { repository.buscar(any(), any()) } returns
                Result.success(BusquedaResponse(resultados = emptyList(), total = 0))

        val viewModel = vm()

        for (query in queriesEspeciales) {
            // No debe lanzar excepción
            try {
                viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = query))
                // Si llegamos aquí, no crasheó
                assertTrue("Query '$query' no debe causar crash", true)
            } catch (e: Exception) {
                fail("Query '$query' causó excepción inesperada: ${e.message}")
            }
        }
    }

    @Test
    fun `journey_query_con_tildes_y_enie_funciona_correctamente`() = runTest {
        coEvery { repository.buscar("prescripción adquisitiva de dominio", any()) } returns
                Result.success(BusquedaResponse(resultados = emptyList(), total = 0))

        val viewModel = vm()
        // No debe crashear con caracteres latinos
        viewModel.onEvent(
            BuscadorEvent.BuscarJurisprudencia(query = "prescripción adquisitiva de dominio")
        )

        assertEquals(
            "Query con tildes debe persistir en estado",
            "prescripción adquisitiva de dominio",
            viewModel.state.value.query
        )
    }

    @Test
    fun `journey_query_muy_largo_no_crashea`() = runTest {
        // Query de 500 caracteres simulando copiar-pegar de un expediente
        val queryLargo = "despido arbitrario ".repeat(25).trim()
        coEvery { repository.buscar(any(), any()) } returns
                Result.success(BusquedaResponse(resultados = emptyList(), total = 0))

        val viewModel = vm()
        viewModel.onEvent(BuscadorEvent.BuscarJurisprudencia(query = queryLargo))

        assertFalse("No debe crashear con query largo", viewModel.state.value.isLoading)
    }

    // ─── Journey adicional: Filtros opcionales ────────────────────

    @Test
    fun `journey_busqueda_con_filtro_materia_penal`() = runTest {
        val filtros = FiltrosJurisprudencia(materia = "PENAL", anio = 2024)
        coEvery { repository.buscar("detención preventiva", filtros) } returns
                Result.success(BusquedaResponse(resultados = emptyList(), total = 0))

        val viewModel = vm()
        viewModel.onEvent(
            BuscadorEvent.BuscarJurisprudencia(query = "detención preventiva", filtros = filtros)
        )

        // Los filtros se pasan correctamente al repositorio
        coVerify(exactly = 1) { repository.buscar("detención preventiva", filtros) }
    }
}
