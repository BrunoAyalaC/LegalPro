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
// Contrato MVI local — usado mientras SimuladorJuiciosViewModel no existe en prod
// ─────────────────────────────────────────────────────────────────────────────

/** Representa un turno dentro de la simulación (abogado, fiscal, juez) */
enum class TurnoSimulacion { ABOGADO, FISCAL, JUEZ }

/** Tipo de simulación disponible */
enum class TipoSimulacion { PENAL, CIVIL, LABORAL }

/** Mensaje emitido durante la simulación */
data class MensajeSimulacion(
    val id: String,
    val texto: String,
    val emisor: TurnoSimulacion,
    val esIa: Boolean = false
)

/** Estado observable del simulador */
data class SimuladorState(
    val isLoading: Boolean = false,
    val mensajes: List<MensajeSimulacion> = emptyList(),
    val turnoActual: TurnoSimulacion = TurnoSimulacion.ABOGADO,
    val error: String? = null,
    val simulacionFinalizada: Boolean = false,
    val simulacionActiva: Boolean = false
)

/** Eventos que el usuario puede disparar */
sealed class SimuladorEvent {
    data class IniciarSimulacion(val tipo: TipoSimulacion) : SimuladorEvent()
    data class EnviarMensaje(val texto: String) : SimuladorEvent()
    object ReiniciarSimulacion : SimuladorEvent()
}

/** Efectos de un solo disparo (side-effects) */
sealed class SimuladorEffect {
    object NavigateToResult : SimuladorEffect()
    data class ShowError(val msg: String) : SimuladorEffect()
    object SimulacionFinalizada : SimuladorEffect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaz del repositorio del simulador (stub para tests)
// ─────────────────────────────────────────────────────────────────────────────

interface SimuladorRepository {
    suspend fun iniciarSimulacion(tipo: TipoSimulacion): Result<String>
    suspend fun enviarMensaje(sessionId: String, texto: String): Result<MensajeSimulacion>
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewModel hipotético usado como sujeto bajo prueba
// Implementa la lógica MVI sin Android Framework
// ─────────────────────────────────────────────────────────────────────────────

class SimuladorJuiciosViewModelStub(
    private val repository: SimuladorRepository
) {
    private val _state = MutableStateFlow(SimuladorState())
    val state: StateFlow<SimuladorState> = _state.asStateFlow()

    private val _effect = MutableSharedFlow<SimuladorEffect>(extraBufferCapacity = 8)
    val effect: SharedFlow<SimuladorEffect> = _effect.asSharedFlow()

    private var sessionId: String? = null

    suspend fun onEvent(event: SimuladorEvent) {
        when (event) {
            is SimuladorEvent.IniciarSimulacion -> iniciarSimulacion(event.tipo)
            is SimuladorEvent.EnviarMensaje     -> enviarMensaje(event.texto)
            SimuladorEvent.ReiniciarSimulacion  -> reiniciar()
        }
    }

    private suspend fun iniciarSimulacion(tipo: TipoSimulacion) {
        _state.value = _state.value.copy(isLoading = true, error = null)
        repository.iniciarSimulacion(tipo).fold(
            onSuccess = { id ->
                sessionId = id
                _state.value = _state.value.copy(
                    isLoading = false,
                    simulacionActiva = true,
                    turnoActual = TurnoSimulacion.ABOGADO
                )
            },
            onFailure = { ex ->
                _state.value = _state.value.copy(isLoading = false, error = ex.message)
                _effect.emit(SimuladorEffect.ShowError(ex.message ?: "Error de red"))
            }
        )
    }

    private suspend fun enviarMensaje(texto: String) {
        val sid = sessionId
        if (sid == null || !_state.value.simulacionActiva) {
            _effect.emit(SimuladorEffect.ShowError("No hay simulación activa"))
            return
        }
        _state.value = _state.value.copy(isLoading = true, error = null)
        repository.enviarMensaje(sid, texto).fold(
            onSuccess = { msg ->
                val actualizados = _state.value.mensajes + msg
                val finalizada = actualizados.size >= 10 // regla de negocio stub
                _state.value = _state.value.copy(
                    isLoading = false,
                    mensajes = actualizados,
                    simulacionFinalizada = finalizada
                )
                if (finalizada) {
                    _effect.emit(SimuladorEffect.SimulacionFinalizada)
                }
            },
            onFailure = { ex ->
                _state.value = _state.value.copy(isLoading = false, error = ex.message)
                _effect.emit(SimuladorEffect.ShowError(ex.message ?: "Error al enviar"))
            }
        )
    }

    private fun reiniciar() {
        sessionId = null
        _state.value = SimuladorState()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY TESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JOURNEY TESTS — SimuladorJuiciosViewModel
 * Cubre: estado inicial, inicio de simulación, envío de mensajes,
 * reinicio, simulación finalizada y errores de red.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SimuladorJuiciosViewModelJourneyTest {

    private val repository: SimuladorRepository = mockk()
    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() { Dispatchers.setMain(testDispatcher) }

    @After
    fun tearDown() { Dispatchers.resetMain() }

    private fun vm() = SimuladorJuiciosViewModelStub(repository)

    // ─── Journey 1: Estado inicial correcto ───────────────────────

    @Test
    fun `journey_estado_inicial_es_correcto`() = runTest {
        // No se necesita mock porque no se llama al repositorio
        val viewModel = vm()
        val state = viewModel.state.value

        assertFalse("No debe estar cargando al inicio", state.isLoading)
        assertTrue("Lista de mensajes debe estar vacía", state.mensajes.isEmpty())
        assertFalse("Simulación no debe estar activa", state.simulacionActiva)
        assertFalse("Simulación no debe estar finalizada", state.simulacionFinalizada)
        assertNull("No debe haber error inicial", state.error)
        assertEquals(TurnoSimulacion.ABOGADO, state.turnoActual)
    }

    // ─── Journey 2: Iniciar simulación cambia isLoading ───────────

    @Test
    fun `journey_iniciar_simulacion_activa_la_simulacion`() = runTest {
        coEvery { repository.iniciarSimulacion(TipoSimulacion.PENAL) } returns
                Result.success("session-penal-001")

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.PENAL))

        val state = viewModel.state.value
        assertFalse("isLoading debe ser false tras respuesta", state.isLoading)
        assertTrue("Simulación debe estar activa tras éxito", state.simulacionActiva)
        assertNull("No debe haber error", state.error)
    }

    @Test
    fun `journey_iniciar_simulacion_civil_sets_turno_inicial_abogado`() = runTest {
        coEvery { repository.iniciarSimulacion(TipoSimulacion.CIVIL) } returns
                Result.success("session-civil-002")

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.CIVIL))

        assertEquals(TurnoSimulacion.ABOGADO, viewModel.state.value.turnoActual)
    }

    // ─── Journey 3: Enviar mensaje sin simulación activa → ShowError

    @Test
    fun `journey_enviar_mensaje_sin_simulacion_activa_emite_ShowError`() = runTest {
        val viewModel = vm()

        viewModel.effect.test {
            viewModel.onEvent(SimuladorEvent.EnviarMensaje("Objeción su señoría"))
            val effect = awaitItem()
            assertTrue(
                "Debe emitir ShowError cuando no hay simulación activa",
                effect is SimuladorEffect.ShowError
            )
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `journey_enviar_mensaje_sin_simulacion_no_cambia_lista_mensajes`() = runTest {
        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.EnviarMensaje("Mensaje sin sesión"))

        assertTrue("La lista de mensajes debe seguir vacía", viewModel.state.value.mensajes.isEmpty())
    }

    // ─── Journey 4: Reiniciar simulación limpia el estado ─────────

    @Test
    fun `journey_reiniciar_simulacion_limpia_estado_completamente`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns Result.success("session-xyz")
        coEvery { repository.enviarMensaje(any(), any()) } returns Result.success(
            MensajeSimulacion("m1", "Primer alegato", TurnoSimulacion.ABOGADO)
        )

        val viewModel = vm()
        // Iniciar y enviar para tener estado sucio
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.LABORAL))
        viewModel.onEvent(SimuladorEvent.EnviarMensaje("Alegato inicial"))

        // Reiniciar
        viewModel.onEvent(SimuladorEvent.ReiniciarSimulacion)

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertTrue("Mensajes deben borrarse al reiniciar", state.mensajes.isEmpty())
        assertFalse("Simulación no debe estar activa", state.simulacionActiva)
        assertFalse("Simulación no debe estar finalizada", state.simulacionFinalizada)
        assertNull("Error debe limpiarse", state.error)
    }

    // ─── Journey 5: Simulación finalizada → effect SimulacionFinalizada

    @Test
    fun `journey_simulacion_finalizada_emite_effect_correcto`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns Result.success("session-fin")

        // Generar 10 mensajes para alcanzar el límite que dispara 'finalizada'
        var contador = 0
        coEvery { repository.enviarMensaje(any(), any()) } answers {
            contador++
            Result.success(MensajeSimulacion("m$contador", "Mensaje $contador", TurnoSimulacion.ABOGADO))
        }

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.PENAL))

        viewModel.effect.test {
            // Enviar 10 mensajes para cruzar el umbral
            repeat(10) { viewModel.onEvent(SimuladorEvent.EnviarMensaje("Argumento ${it + 1}")) }

            val effect = awaitItem()
            assertTrue(
                "Debe emitir SimulacionFinalizada",
                effect is SimuladorEffect.SimulacionFinalizada
            )
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `journey_simulacion_finalizada_actualiza_flag_en_estado`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns Result.success("session-flag")
        var idx = 0
        coEvery { repository.enviarMensaje(any(), any()) } answers {
            idx++
            Result.success(MensajeSimulacion("m$idx", "Msg $idx", TurnoSimulacion.FISCAL))
        }

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.CIVIL))
        repeat(10) { viewModel.onEvent(SimuladorEvent.EnviarMensaje("msg $it")) }

        assertTrue("simulacionFinalizada debe ser true", viewModel.state.value.simulacionFinalizada)
    }

    // ─── Journey 6: Error de red → error visible en estado ────────

    @Test
    fun `journey_error_de_red_al_iniciar_se_refleja_en_estado`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns
                Result.failure(Exception("Sin conexión a internet"))

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.PENAL))

        val state = viewModel.state.value
        assertFalse("isLoading debe ser false tras error", state.isLoading)
        assertNotNull("Debe haber mensaje de error", state.error)
        assertTrue(state.error!!.contains("Sin conexión"))
        assertFalse("Simulación no debe activarse tras error", state.simulacionActiva)
    }

    @Test
    fun `journey_error_de_red_al_iniciar_emite_ShowError`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns
                Result.failure(Exception("Timeout del servidor"))

        val viewModel = vm()
        viewModel.effect.test {
            viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.LABORAL))
            val effect = awaitItem()
            assertTrue(effect is SimuladorEffect.ShowError)
            assertTrue((effect as SimuladorEffect.ShowError).msg.contains("Timeout"))
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `journey_error_al_enviar_mensaje_muestra_error_en_estado`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns Result.success("session-err")
        coEvery { repository.enviarMensaje(any(), any()) } returns
                Result.failure(Exception("Error de IA"))

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.CIVIL))
        viewModel.onEvent(SimuladorEvent.EnviarMensaje("Alegato con error"))

        assertNotNull("Debe haber error en el estado", viewModel.state.value.error)
        assertFalse("isLoading debe ser false", viewModel.state.value.isLoading)
    }

    // ─── Journey 7: Lista de mensajes crece con cada envío ────────

    @Test
    fun `journey_lista_mensajes_crece_con_cada_envio_exitoso`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns Result.success("session-grow")
        var n = 0
        coEvery { repository.enviarMensaje(any(), any()) } answers {
            n++
            Result.success(MensajeSimulacion("m$n", "Argumento $n", TurnoSimulacion.ABOGADO))
        }

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.PENAL))

        viewModel.onEvent(SimuladorEvent.EnviarMensaje("Primer argumento"))
        assertEquals(1, viewModel.state.value.mensajes.size)

        viewModel.onEvent(SimuladorEvent.EnviarMensaje("Segundo argumento"))
        assertEquals(2, viewModel.state.value.mensajes.size)

        viewModel.onEvent(SimuladorEvent.EnviarMensaje("Tercer argumento"))
        assertEquals(3, viewModel.state.value.mensajes.size)
    }

    @Test
    fun `journey_mensajes_contienen_texto_enviado`() = runTest {
        coEvery { repository.iniciarSimulacion(any()) } returns Result.success("session-txt")
        coEvery { repository.enviarMensaje(any(), "Objeción irrelevante") } returns
                Result.success(MensajeSimulacion("m1", "Objeción irrelevante", TurnoSimulacion.ABOGADO))

        val viewModel = vm()
        viewModel.onEvent(SimuladorEvent.IniciarSimulacion(TipoSimulacion.PENAL))
        viewModel.onEvent(SimuladorEvent.EnviarMensaje("Objeción irrelevante"))

        val mensaje = viewModel.state.value.mensajes.first()
        assertEquals("Objeción irrelevante", mensaje.texto)
    }
}
