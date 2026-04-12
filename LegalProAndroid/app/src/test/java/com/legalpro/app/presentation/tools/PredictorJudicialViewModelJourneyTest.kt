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
// Contrato MVI local — usado mientras PredictorJudicialViewModel no existe en prod
// ─────────────────────────────────────────────────────────────────────────────

/** Materias legales válidas en el contexto peruano */
enum class MateriaLegal { PENAL, CIVIL, LABORAL, CONSTITUCIONAL, FAMILIAR, ADMINISTRATIVO }

/** Resultado de la predicción judicial */
data class PrediccionResultado(
    val descripcion: String,
    val porcentajeExito: Int,          // 0–100
    val factoresClave: List<String>,
    val materia: MateriaLegal,
    val juzgado: String
)

/** Estado observable del predictor */
data class PredictorState(
    val isLoading: Boolean = false,
    val prediccion: PrediccionResultado? = null,
    val factoresClave: List<String> = emptyList(),
    val porcentajeExito: Int = 0,
    val error: String? = null
)

/** Eventos que el usuario puede disparar */
sealed class PredictorEvent {
    data class AnalizarCaso(
        val descripcion: String,
        val materia: MateriaLegal,
        val juzgado: String
    ) : PredictorEvent()

    object LimpiarPrediccion : PredictorEvent()
}

/** Efectos de un solo disparo */
sealed class PredictorEffect {
    object ReporteListo : PredictorEffect()
    data class ShowError(val msg: String) : PredictorEffect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaz del repositorio del predictor (stub para tests)
// ─────────────────────────────────────────────────────────────────────────────

interface PredictorRepository {
    suspend fun predecirResultado(
        descripcion: String,
        materia: MateriaLegal,
        juzgado: String
    ): Result<PrediccionResultado>
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewModel hipotético sujeto bajo prueba
// ─────────────────────────────────────────────────────────────────────────────

class PredictorJudicialViewModelStub(
    private val repository: PredictorRepository
) {
    private val _state = MutableStateFlow(PredictorState())
    val state: StateFlow<PredictorState> = _state.asStateFlow()

    private val _effect = MutableSharedFlow<PredictorEffect>(extraBufferCapacity = 8)
    val effect: SharedFlow<PredictorEffect> = _effect.asSharedFlow()

    suspend fun onEvent(event: PredictorEvent) {
        when (event) {
            is PredictorEvent.AnalizarCaso     -> analizarCaso(event.descripcion, event.materia, event.juzgado)
            PredictorEvent.LimpiarPrediccion   -> limpiar()
        }
    }

    private suspend fun analizarCaso(descripcion: String, materia: MateriaLegal, juzgado: String) {
        // Validación de dominio: descripción obligatoria
        if (descripcion.isBlank()) {
            _state.value = _state.value.copy(error = "La descripción del caso es obligatoria")
            return
        }

        _state.value = _state.value.copy(isLoading = true, error = null)

        repository.predecirResultado(descripcion, materia, juzgado).fold(
            onSuccess = { prediccion ->
                _state.value = _state.value.copy(
                    isLoading = false,
                    prediccion = prediccion,
                    factoresClave = prediccion.factoresClave,
                    porcentajeExito = prediccion.porcentajeExito.coerceIn(0, 100)
                )
                _effect.emit(PredictorEffect.ReporteListo)
            },
            onFailure = { ex ->
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = ex.message ?: "Error del servicio IA"
                )
                _effect.emit(PredictorEffect.ShowError(ex.message ?: "Error del servicio IA"))
            }
        )
    }

    private fun limpiar() {
        _state.value = PredictorState()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY TESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JOURNEY TESTS — PredictorJudicialViewModel
 * Cubre: estado inicial, análisis de casos, validaciones,
 * limpieza de predicción y manejo de errores del servicio IA.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PredictorJudicialViewModelJourneyTest {

    private val repository: PredictorRepository = mockk()
    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() { Dispatchers.setMain(testDispatcher) }

    @After
    fun tearDown() { Dispatchers.resetMain() }

    private fun vm() = PredictorJudicialViewModelStub(repository)

    // ─── Journey 1: Estado inicial limpio ─────────────────────────

    @Test
    fun `journey_estado_inicial_es_limpio`() = runTest {
        val viewModel = vm()
        val state = viewModel.state.value

        assertFalse("No debe estar cargando al inicio", state.isLoading)
        assertNull("No debe haber predicción inicial", state.prediccion)
        assertTrue("Factores clave deben estar vacíos", state.factoresClave.isEmpty())
        assertEquals("Porcentaje inicial debe ser 0", 0, state.porcentajeExito)
        assertNull("No debe haber error inicial", state.error)
    }

    // ─── Journey 2: Analizar caso sin descripción → error de validación

    @Test
    fun `journey_analizar_caso_con_descripcion_vacia_produce_error_validacion`() = runTest {
        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "",
                materia = MateriaLegal.PENAL,
                juzgado = "Juzgado Penal Lima Norte"
            )
        )

        val state = viewModel.state.value
        assertNotNull("Debe haber error de validación", state.error)
        assertTrue(state.error!!.contains("descripción"))
        assertFalse("No debe iniciar carga con descripción vacía", state.isLoading)
        assertNull("No debe haber predicción", state.prediccion)
    }

    @Test
    fun `journey_analizar_caso_con_espacio_en_blanco_produce_error`() = runTest {
        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "   ",
                materia = MateriaLegal.CIVIL,
                juzgado = "Juzgado Civil Lima"
            )
        )

        assertNotNull("Descripción con solo espacios no es válida", viewModel.state.value.error)
    }

    // ─── Journey 3: Analizar caso penal con mock → predicción calculada

    @Test
    fun `journey_analizar_caso_penal_exitoso_produce_prediccion`() = runTest {
        val prediccionEsperada = PrediccionResultado(
            descripcion = "Alta probabilidad de absolución",
            porcentajeExito = 72,
            factoresClave = listOf("Falta de pruebas directas", "Coartada verificada", "Testigos favorables"),
            materia = MateriaLegal.PENAL,
            juzgado = "3er Juzgado Penal Lima"
        )
        coEvery {
            repository.predecirResultado(any(), MateriaLegal.PENAL, any())
        } returns Result.success(prediccionEsperada)

        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "Acusado de robo agravado sin pruebas concretas",
                materia = MateriaLegal.PENAL,
                juzgado = "3er Juzgado Penal Lima"
            )
        )

        val state = viewModel.state.value
        assertFalse("isLoading debe ser false tras respuesta", state.isLoading)
        assertNotNull("Debe haber predicción tras análisis exitoso", state.prediccion)
        assertEquals(72, state.porcentajeExito)
        assertNull("No debe haber error", state.error)
    }

    @Test
    fun `journey_analizar_caso_penal_emite_efecto_ReporteListo`() = runTest {
        val prediccion = PrediccionResultado(
            descripcion = "Resultado favorable",
            porcentajeExito = 65,
            factoresClave = listOf("Jurisprudencia favorable"),
            materia = MateriaLegal.PENAL,
            juzgado = "1er Juzgado Penal"
        )
        coEvery { repository.predecirResultado(any(), any(), any()) } returns Result.success(prediccion)

        val viewModel = vm()
        viewModel.effect.test {
            viewModel.onEvent(
                PredictorEvent.AnalizarCaso(
                    descripcion = "Caso de robo agravado en grado de tentativa",
                    materia = MateriaLegal.PENAL,
                    juzgado = "1er Juzgado Penal"
                )
            )
            val effect = awaitItem()
            assertTrue("Debe emitir ReporteListo", effect is PredictorEffect.ReporteListo)
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── Journey 4: Limpiar predicción resetea el estado ──────────

    @Test
    fun `journey_limpiar_prediccion_resetea_estado_completamente`() = runTest {
        val prediccion = PrediccionResultado(
            descripcion = "Resultado",
            porcentajeExito = 80,
            factoresClave = listOf("Factor A", "Factor B"),
            materia = MateriaLegal.LABORAL,
            juzgado = "Juzgado Laboral"
        )
        coEvery { repository.predecirResultado(any(), any(), any()) } returns Result.success(prediccion)

        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "Despido arbitrario sin carta de preaviso",
                materia = MateriaLegal.LABORAL,
                juzgado = "Juzgado Laboral Lima"
            )
        )

        // Verificar estado tiene datos
        assertNotNull(viewModel.state.value.prediccion)

        // Limpiar
        viewModel.onEvent(PredictorEvent.LimpiarPrediccion)

        val state = viewModel.state.value
        assertNull("Predicción debe ser null tras limpiar", state.prediccion)
        assertTrue("Factores clave deben estar vacíos", state.factoresClave.isEmpty())
        assertEquals("Porcentaje debe ser 0", 0, state.porcentajeExito)
        assertNull("Error debe ser null", state.error)
        assertFalse("isLoading debe ser false", state.isLoading)
    }

    // ─── Journey 5: Error del servicio IA → error en estado ───────

    @Test
    fun `journey_error_servicio_ia_muestra_error_y_limpia_loading`() = runTest {
        coEvery {
            repository.predecirResultado(any(), any(), any())
        } returns Result.failure(Exception("Servicio Gemini no disponible"))

        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "Caso con fallo del servicio de IA",
                materia = MateriaLegal.CIVIL,
                juzgado = "Juzgado Civil"
            )
        )

        val state = viewModel.state.value
        assertFalse("isLoading debe ser false tras error", state.isLoading)
        assertNotNull("Debe haber error en estado", state.error)
        assertTrue(state.error!!.contains("Gemini"))
        assertNull("No debe haber predicción", state.prediccion)
    }

    @Test
    fun `journey_error_servicio_ia_emite_ShowError`() = runTest {
        coEvery { repository.predecirResultado(any(), any(), any()) } returns
                Result.failure(Exception("Timeout al conectar con IA"))

        val viewModel = vm()
        viewModel.effect.test {
            viewModel.onEvent(
                PredictorEvent.AnalizarCaso(
                    descripcion = "Caso válido con error de servicio",
                    materia = MateriaLegal.PENAL,
                    juzgado = "Juzgado Penal"
                )
            )
            val effect = awaitItem()
            assertTrue("Debe emitir ShowError", effect is PredictorEffect.ShowError)
            assertTrue((effect as PredictorEffect.ShowError).msg.contains("Timeout"))
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── Journey 6: Porcentaje de éxito dentro de [0, 100] ────────

    @Test
    fun `journey_porcentaje_exito_siempre_dentro_de_rango_valido`() = runTest {
        // El ViewModel aplica coerceIn(0, 100) para garantizar el rango
        val prediccionConValorAlto = PrediccionResultado(
            descripcion = "Caso fuerte",
            porcentajeExito = 150, // Valor inválido del servidor
            factoresClave = listOf("Factor A"),
            materia = MateriaLegal.CIVIL,
            juzgado = "Juzgado Civil"
        )
        coEvery { repository.predecirResultado(any(), any(), any()) } returns
                Result.success(prediccionConValorAlto)

        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "Caso con porcentaje fuera de rango",
                materia = MateriaLegal.CIVIL,
                juzgado = "Juzgado Civil Lima"
            )
        )

        val porcentaje = viewModel.state.value.porcentajeExito
        assertTrue("Porcentaje debe ser <= 100", porcentaje <= 100)
        assertTrue("Porcentaje debe ser >= 0", porcentaje >= 0)
    }

    @Test
    fun `journey_porcentaje_negativo_es_normalizado_a_cero`() = runTest {
        val prediccionNegativa = PrediccionResultado(
            descripcion = "Caso difícil",
            porcentajeExito = -20, // Valor inválido
            factoresClave = emptyList(),
            materia = MateriaLegal.PENAL,
            juzgado = "Juzgado Penal"
        )
        coEvery { repository.predecirResultado(any(), any(), any()) } returns
                Result.success(prediccionNegativa)

        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "Caso muy difícil de defender",
                materia = MateriaLegal.PENAL,
                juzgado = "Juzgado Penal Norte"
            )
        )

        assertEquals("Porcentaje negativo debe normalizarse a 0", 0, viewModel.state.value.porcentajeExito)
    }

    // ─── Journey 7: Caso laboral devuelve factores clave ──────────

    @Test
    fun `journey_caso_laboral_retorna_factores_clave_en_estado`() = runTest {
        val factores = listOf(
            "Indemnización por despido arbitrario aplicable",
            "Ausencia de amonestaciones previas documentadas",
            "Tiempo de servicios mayor a 3 meses",
            "Carta de despido sin causa documentada"
        )
        val prediccion = PrediccionResultado(
            descripcion = "Alta probabilidad de éxito en demanda laboral",
            porcentajeExito = 85,
            factoresClave = factores,
            materia = MateriaLegal.LABORAL,
            juzgado = "2do Juzgado Laboral Lima"
        )
        coEvery {
            repository.predecirResultado(any(), MateriaLegal.LABORAL, any())
        } returns Result.success(prediccion)

        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "Trabajador despedido sin causa justificada tras 5 años de servicio",
                materia = MateriaLegal.LABORAL,
                juzgado = "2do Juzgado Laboral Lima"
            )
        )

        val state = viewModel.state.value
        assertEquals("Debe haber 4 factores clave", 4, state.factoresClave.size)
        assertTrue("Factores deben incluir indemnización", state.factoresClave.any { it.contains("Indemnización") })
        assertEquals(85, state.porcentajeExito)
    }

    @Test
    fun `journey_caso_laboral_sin_factores_clave_produce_lista_vacia`() = runTest {
        val prediccion = PrediccionResultado(
            descripcion = "Resultado incierto",
            porcentajeExito = 50,
            factoresClave = emptyList(),
            materia = MateriaLegal.LABORAL,
            juzgado = "Juzgado Laboral"
        )
        coEvery { repository.predecirResultado(any(), any(), any()) } returns Result.success(prediccion)

        val viewModel = vm()
        viewModel.onEvent(
            PredictorEvent.AnalizarCaso(
                descripcion = "Caso ambiguo sin factores determinantes",
                materia = MateriaLegal.LABORAL,
                juzgado = "Juzgado Laboral Norte"
            )
        )

        assertTrue("Lista de factores vacía es válida", viewModel.state.value.factoresClave.isEmpty())
        assertNull("No debe haber error", viewModel.state.value.error)
    }
}
