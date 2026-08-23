/**
 * RagRepository - Cliente RAG para Android
 *
 * Consume los endpoints IA del backend LegalPro y normaliza la respuesta
 * a un modelo [RagResponse] con citaciones y metadata RAG.
 *
 * El backend (ver `legalpro-app/server/middleware/ragMiddleware.js`) inyecta
 * el bloque RAG en los handlers IA cuando `ENABLE_RAG=true`:
 *   - citaciones: List<{ numero, fuente, similitud, url, metadata }>
 *   - fuentes_consultadas: List<String>
 *   - rag_usado, rag_chunks, rag_similitud_promedio, rag_fecha_consulta
 *
 * Este repository no depende de campos tipados de los DTOs de respuesta:
 * extrae el bloque RAG directamente del JSON de la respuesta, de modo que
 * cualquier endpoint IA existente o futuro puede beneficiarse del contrato
 * sin acoplarse a una clase de respuesta específica.
 *
 * @author @android
 * @version 1.0.0
 * @date 2026-08-01
 */

package com.legalpro.app.data.rag

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.legalpro.app.data.remote.LegalProApi
import com.legalpro.app.data.remote.dto.AnalizarExpedienteRequest
import com.legalpro.app.data.remote.dto.BusquedaJurisprudenciaRequest
import com.legalpro.app.data.remote.dto.ChatRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Respuesta normalizada de IA con contexto RAG opcional.
 *
 * @property contenido Texto principal devuelto por el modelo (analisis, respuesta, etc.).
 * @property provider Identificador corto del proveedor ("minimax" | "gemini").
 * @property providerLabel Etiqueta legible del proveedor para UI.
 * @property model Modelo exacto utilizado por el proveedor.
 * @property citaciones Fuentes legales consultadas por el RAG, en orden de relevancia.
 * @property fuentesConsultadas Lista legible de fuentes únicas consultadas.
 * @property ragUsado `true` si el backend inyectó contexto RAG en esta respuesta.
 * @property ragChunks Cantidad de chunks de la base legal utilizados.
 * @property ragSimilitudPromedio Similitud coseno promedio (0.0 - 1.0).
 * @property ragFechaConsulta Timestamp ISO 8601 de la consulta a la base legal.
 * @property necesitaRevisionHumana Por compliance, todas las respuestas IA requieren
 *           revisión humana. Se mantiene `true` por defecto y no se desactiva aunque
 *           el backend no envíe el campo.
 */
data class RagResponse(
    val contenido: String,
    val provider: String,
    val providerLabel: String,
    val model: String,
    val citaciones: List<Citacion>,
    val fuentesConsultadas: List<String>,
    val ragUsado: Boolean,
    val ragChunks: Int = 0,
    val ragSimilitudPromedio: Double = 0.0,
    val ragFechaConsulta: String? = null,
    val necesitaRevisionHumana: Boolean = true
)

/**
 * Citación individual devuelta por el RAG.
 *
 * @property numero Índice 1-based que debe referenciarse en el texto como [n].
 * @property fuente Descripción legible de la fuente (artículo, sentencia, norma).
 * @property similitud Score coseno 0.0 - 1.0 entre la consulta y el chunk.
 * @property url Enlace a la fuente oficial cuando esté disponible (SPIJ, TC, PJ).
 * @property metadata Atributos extra (articulo, expediente, fecha, etc.).
 */
data class Citacion(
    val numero: Int,
    val fuente: String,
    val similitud: Double,
    val url: String?,
    val metadata: Map<String, String> = emptyMap()
)

/**
 * Repository singleton para consumir respuestas IA con/sin contexto RAG.
 *
 * Las dependencias se inyectan por constructor y `LegalProApi` reutiliza los
 * interceptores de `NetworkModule` (X-Correlation-ID + Authorization Bearer).
 */
@Singleton
class RagRepository @Inject constructor(
    private val api: LegalProApi
) {
    private val gson: Gson = Gson()

    /**
     * Analiza un expediente/consulta con RAG automático.
     *
     * Mapea internamente al endpoint `POST /api/analista/analizar`.
     */
    suspend fun consultarConRag(
        materia: String,
        consulta: String,
        contexto: String = "",
        expedienteId: String? = null
    ): RagResponse {
        val request = AnalizarExpedienteRequest(
            materia = materia,
            consulta = consulta,
            contexto = contexto,
            expedienteId = expedienteId
        )
        val response = api.analizarExpediente(request)
        return parseRagResponse(
            response = response,
            contentFieldCandidates = listOf("analisis", "respuesta", "contenido", "texto")
        )
    }

    /**
     * Envía un mensaje de chat con RAG automático.
     *
     * Mapea internamente al endpoint `POST /api/chat/enviar`.
     */
    suspend fun chatConRag(
        mensaje: String,
        materia: String,
        expedienteId: String? = null
    ): RagResponse {
        val request = ChatRequest(
            mensaje = mensaje,
            materia = materia,
            expedienteId = expedienteId
        )
        val response = api.enviarMensajeChat(request)
        return parseRagResponse(
            response = response,
            contentFieldCandidates = listOf("respuesta", "mensaje", "contenido", "analisis")
        )
    }

    /**
     * Búsqueda de jurisprudencia con RAG (5 fuentes oficiales).
     *
     * Mapea internamente al endpoint `POST /api/jurisprudencia/buscar`.
     */
    suspend fun buscarJurisprudencia(
        query: String,
        materia: String,
        limit: Int = 10
    ): RagResponse {
        val request = BusquedaJurisprudenciaRequest(
            query = query,
            materia = materia,
            limit = limit
        )
        val response = api.buscarJurisprudencia(request)
        return parseRagResponse(
            response = response,
            contentFieldCandidates = listOf("resultados", "analisis", "respuesta", "contenido")
        )
    }

    // ---------------------------------------------------------------------
    // Mappers internos
    // ---------------------------------------------------------------------

    /**
     * Parsea una respuesta Retrofit a [RagResponse].
     *
     * Estrategia:
     *  1. Si el body es null, devuelve un [RagResponse] vacío pero válido.
     *  2. Convierte el body a JSON via Gson (sin acoplarse a un DTO específico).
     *  3. Extrae el contenido probando varios campos candidatos.
     *  4. Lee el bloque RAG con prefijo `rag_*` y `citaciones`/`fuentes_consultadas`
     *     según el contrato de `withRagContext()` en ragMiddleware.js.
     */
    private fun parseRagResponse(
        response: retrofit2.Response<*>,
        contentFieldCandidates: List<String>
    ): RagResponse {
        val body = response.body()
        if (body == null) {
            return emptyRagResponse()
        }

        val json: JsonObject = runCatching { gson.toJsonTree(body).asJsonObject }
            .getOrElse { return emptyRagResponse() }

        val contenido = extractContent(json, contentFieldCandidates)

        return RagResponse(
            contenido = contenido,
            provider = json.stringOrNull("provider") ?: DEFAULT_PROVIDER,
            providerLabel = json.stringOrNull("provider_label") ?: DEFAULT_PROVIDER_LABEL,
            model = json.stringOrNull("model") ?: DEFAULT_MODEL,
            citaciones = parseCitaciones(json.get("citaciones")?.asJsonArray),
            fuentesConsultadas = parseFuentes(json.get("fuentes_consultadas")?.asJsonArray),
            ragUsado = json.get("rag_usado")?.asBoolean ?: false,
            ragChunks = json.get("rag_chunks")?.asInt ?: 0,
            ragSimilitudPromedio = json.get("rag_similitud_promedio")?.asDouble ?: 0.0,
            ragFechaConsulta = json.stringOrNull("rag_fecha_consulta"),
            // Por compliance LPDP/IA: toda respuesta IA requiere revisión humana.
            necesitaRevisionHumana = true
        )
    }

    private fun emptyRagResponse(): RagResponse = RagResponse(
        contenido = "",
        provider = DEFAULT_PROVIDER,
        providerLabel = DEFAULT_PROVIDER_LABEL,
        model = DEFAULT_MODEL,
        citaciones = emptyList(),
        fuentesConsultadas = emptyList(),
        ragUsado = false,
        necesitaRevisionHumana = true
    )

    private fun extractContent(json: JsonObject, candidates: List<String>): String {
        for (field in candidates) {
            val value = json.get(field) ?: continue
            if (value.isJsonNull) continue
            // Si el campo es string, lo usamos directamente.
            if (value.isJsonPrimitive && value.asJsonPrimitive.isString) {
                return value.asString
            }
            // Si es array de objetos (p.ej. resultados de jurisprudencia),
            // concatenamos un campo representativo de cada elemento.
            if (value.isJsonArray) {
                val joined = value.asJsonArray.joinToString("\n\n") { element ->
                    if (element.isJsonObject) {
                        element.asJsonObject.let { obj ->
                            obj.stringOrNull("titulo")?.let { titulo ->
                                val resumen = obj.stringOrNull("resumen")
                                    ?: obj.stringOrNull("sumilla")
                                    ?: obj.stringOrNull("texto")
                                    ?: ""
                                if (resumen.isNotBlank()) "$titulo\n$resumen" else titulo
                            } ?: obj.stringOrNull("sumilla")
                                ?: obj.stringOrNull("resumen")
                                ?: obj.stringOrNull("texto")
                                ?: obj.toString()
                        }
                    } else {
                        element.asString
                    }
                }
                if (joined.isNotBlank()) return joined
            }
        }
        return ""
    }

    private fun parseCitaciones(array: JsonArray?): List<Citacion> {
        if (array == null) return emptyList()
        if (array.size() == 0) return emptyList()
        return array.mapNotNull { element ->
            if (!element.isJsonObject) return@mapNotNull null
            val obj = element.asJsonObject
            Citacion(
                numero = obj.get("numero")?.asInt ?: 0,
                fuente = obj.stringOrNull("fuente") ?: return@mapNotNull null,
                similitud = obj.get("similitud")?.asDouble ?: 0.0,
                url = obj.stringOrNull("url") ?: obj.stringOrNull("link"),
                metadata = parseMetadata(obj.get("metadata")?.asJsonObject)
            )
        }
    }

    private fun parseFuentes(array: JsonArray?): List<String> {
        if (array == null) return emptyList()
        return array.mapNotNull { it.takeIf { el -> el.isJsonPrimitive }?.asString }
    }

    private fun parseMetadata(obj: JsonObject?): Map<String, String> {
        if (obj == null) return emptyMap()
        return obj.entrySet()
            .mapNotNull { (key, value) ->
                if (value.isJsonPrimitive && value.asJsonPrimitive.isString) {
                    key to value.asString
                } else {
                    null
                }
            }
            .toMap()
    }

    private fun JsonObject.stringOrNull(field: String): String? {
        val value = this.get(field) ?: return null
        if (value.isJsonNull) return null
        return if (value.isJsonPrimitive && value.asJsonPrimitive.isString) {
            value.asString
        } else {
            value.toString()
        }
    }

    private companion object {
        const val DEFAULT_PROVIDER = "minimax"
        const val DEFAULT_PROVIDER_LABEL = "MiniMax M3"
        const val DEFAULT_MODEL = "MiniMax-M3"
    }
}
