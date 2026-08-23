package com.legalpro.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PanelExpertosResponse(
    @SerializedName("especialidades") val especialidades: List<String>,
    @SerializedName("especialistas_detalles") val especialistasDetalles: List<EspecialistaDetalleDto>,
    @SerializedName("diagnostico") val diagnostico: String,
    @SerializedName("tokens") val tokens: Int?
)

data class EspecialistaDetalleDto(
    @SerializedName("especialista") val especialista: String,
    @SerializedName("timeout") val timeout: Boolean,
    @SerializedName("desdeCache") val desdeCache: Boolean,
    @SerializedName("analisis") val analisis: String
)
