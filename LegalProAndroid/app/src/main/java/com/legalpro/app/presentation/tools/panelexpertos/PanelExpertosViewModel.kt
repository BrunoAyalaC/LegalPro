package com.legalpro.app.presentation.tools.panelexpertos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.legalpro.app.BuildConfig
import com.legalpro.app.data.remote.dto.PanelExpertosRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

@HiltViewModel
class PanelExpertosViewModel @Inject constructor(
    private val client: OkHttpClient
) : ViewModel() {

    private val gson = Gson()

    private val _uiState = MutableStateFlow<PanelExpertosUiState>(PanelExpertosUiState.Idle)
    val uiState: StateFlow<PanelExpertosUiState> = _uiState.asStateFlow()

    fun resetState() {
        _uiState.value = PanelExpertosUiState.Idle
    }

    fun analizarConsulta(
        consulta: String,
        especialistasSeleccionados: List<String>,
        autodetectar: Boolean
    ) {
        if (consulta.trim().isEmpty()) {
            _uiState.value = PanelExpertosUiState.Error("La consulta no puede estar vacía")
            return
        }

        _uiState.value = PanelExpertosUiState.Loading("Iniciando conexión con el panel de expertos...")

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val especialistas = if (autodetectar) emptyList() else especialistasSeleccionados
                val requestDto = PanelExpertosRequest(
                    prompt = consulta,
                    especialistas = especialistas,
                    disclaimerAceptado = true
                )

                val requestBody = gson.toJson(requestDto)
                    .toRequestBody("application/json; charset=utf-8".toMediaType())

                val request = Request.Builder()
                    .url("${BuildConfig.BASE_URL}api/ai/panel-expertos/stream")
                    .post(requestBody)
                    .build()

                val call = client.newCall(request)
                val response = call.execute()

                if (!response.isSuccessful) {
                    _uiState.value = PanelExpertosUiState.Error("Error en servidor: ${response.code} ${response.message}")
                    return@launch
                }

                val body = response.body
                if (body == null) {
                    _uiState.value = PanelExpertosUiState.Error("Respuesta vacía del servidor")
                    return@launch
                }

                val reader = body.charStream().buffered()
                var line: String?

                var currentConsulta = consulta
                var currentEspecialidades = emptyList<String>()
                var currentEspecialistasActivos = emptySet<String>()
                var currentEspecialistasCompletados = emptyMap<String, EspecialistaResultado>()
                var currentDiagnostico = ""

                while (reader.readLine().also { line = it } != null) {
                    val trimmedLine = line!!.trim()
                    if (trimmedLine.startsWith("data: ")) {
                        val dataJson = trimmedLine.substring(6).trim()
                        if (dataJson.isNotEmpty()) {
                            try {
                                val rawEvent = gson.fromJson(dataJson, SseEventRaw::class.java)
                                when (rawEvent.status) {
                                    "enrutando" -> {
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "enrutando",
                                            mensajeEstado = rawEvent.message ?: "Clasificando la consulta legal...",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "enrutado" -> {
                                        currentEspecialidades = rawEvent.especialidades ?: emptyList()
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "enrutado",
                                            mensajeEstado = rawEvent.message ?: "Especialidades asignadas.",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "analizando" -> {
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "analizando",
                                            mensajeEstado = rawEvent.message ?: "Iniciando análisis paralelo...",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "analizando_especialista" -> {
                                        val esp = rawEvent.especialista
                                        if (esp != null) {
                                            currentEspecialistasActivos = currentEspecialistasActivos + esp
                                        }
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "analizando_especialista",
                                            mensajeEstado = rawEvent.message ?: "Especialista analizando...",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "especialista_completado" -> {
                                        val esp = rawEvent.especialista
                                        if (esp != null) {
                                            currentEspecialistasActivos = currentEspecialistasActivos - esp
                                            currentEspecialistasCompletados = currentEspecialistasCompletados + (esp to EspecialistaResultado(
                                                especialista = esp,
                                                timeout = rawEvent.timeout ?: false,
                                                desdeCache = rawEvent.desdeCache ?: false,
                                                mensaje = rawEvent.message ?: ""
                                            ))
                                        }
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "especialista_completado",
                                            mensajeEstado = rawEvent.message ?: "Análisis de especialista listo.",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "analistas_completados" -> {
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "analistas_completados",
                                            mensajeEstado = rawEvent.message ?: "Todos los informes de especialidad han concluido.",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "consolidando" -> {
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "consolidando",
                                            mensajeEstado = rawEvent.message ?: "El Consolidador Master está unificando estrategias...",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "chunk" -> {
                                        val chunkText = rawEvent.chunk ?: ""
                                        currentDiagnostico += chunkText
                                        _uiState.value = PanelExpertosUiState.Streaming(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasActivos = currentEspecialistasActivos,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            estadoActual = "chunk",
                                            mensajeEstado = "Generando diagnóstico consolidado...",
                                            diagnosticoConsolidado = currentDiagnostico
                                        )
                                    }
                                    "done" -> {
                                        _uiState.value = PanelExpertosUiState.Success(
                                            consulta = currentConsulta,
                                            especialidades = currentEspecialidades,
                                            especialistasCompletados = currentEspecialistasCompletados,
                                            diagnosticoConsolidado = currentDiagnostico,
                                            tokens = rawEvent.tokens
                                        )
                                    }
                                    "error" -> {
                                        _uiState.value = PanelExpertosUiState.Error(rawEvent.error ?: "Error procesando el panel de expertos")
                                    }
                                }
                            } catch (e: Exception) {
                                // Ignorar errores de parseo de JSON individuales para no detener el flujo
                            }
                        }
                    }
                }
                reader.close()
            } catch (e: Exception) {
                _uiState.value = PanelExpertosUiState.Error("Error en la conexión con el servidor: ${e.localizedMessage ?: e.message}")
            }
        }
    }
}

data class SseEventRaw(
    val status: String,
    val message: String? = null,
    val especialidades: List<String>? = null,
    val especialista: String? = null,
    val timeout: Boolean? = null,
    val desdeCache: Boolean? = null,
    val chunk: String? = null,
    val tokens: Int? = null,
    val error: String? = null
)
