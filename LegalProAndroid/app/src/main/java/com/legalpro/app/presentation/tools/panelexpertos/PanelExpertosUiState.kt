package com.legalpro.app.presentation.tools.panelexpertos

sealed class PanelExpertosUiState {
    object Idle : PanelExpertosUiState()
    
    data class Loading(val message: String) : PanelExpertosUiState()
    
    data class Streaming(
        val consulta: String,
        val especialidades: List<String>,
        val especialistasActivos: Set<String>,
        val especialistasCompletados: Map<String, EspecialistaResultado>,
        val estadoActual: String, // "enrutando", "analizando", "consolidando", etc.
        val mensajeEstado: String,
        val diagnosticoConsolidado: String
    ) : PanelExpertosUiState()

    data class Success(
        val consulta: String,
        val especialidades: List<String>,
        val especialistasCompletados: Map<String, EspecialistaResultado>,
        val diagnosticoConsolidado: String,
        val tokens: Int?
    ) : PanelExpertosUiState()

    data class Error(val message: String) : PanelExpertosUiState()
}

data class EspecialistaResultado(
    val especialista: String,
    val timeout: Boolean,
    val desdeCache: Boolean,
    val analisis: String = "",
    val mensaje: String = ""
)
