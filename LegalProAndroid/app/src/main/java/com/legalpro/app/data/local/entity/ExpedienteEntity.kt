package com.legalpro.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Entidad que representa un Expediente Judicial almacenado localmente en caché offline.
 */
@Entity(tableName = "expedientes")
data class ExpedienteEntity(
    @PrimaryKey
    val id: String, // Generalmente el número de expediente único o ID del backend
    val numeroExpediente: String, // Formato estándar: XXXXX-YYYY-X-XXXX-XX-XX-XX
    val organoJurisdiccional: String, // Juzgado / Sala
    val materia: String, // Civil, Penal, Laboral, etc.
    val especialidad: String?,
    val estado: String, // EN_TRAMITE, ARCHIVADO, EN_ETAPA_INTERMEDIA, etc.
    val demandante: String,
    val demandado: String,
    val juez: String?,
    val resumenIa: String?, // Resumen estructurado generado por la IA de LegalPro
    val ultimaActualizacionSinoe: Long?, // Timestamp del último scrap/sincronización con SINOE
    val fechaInicio: Long, // Fecha en que se inició el proceso judicial
    val fechaCreacionLocal: Long,
    val estadoSincronizacion: String // SYNCED, PENDING_CREATE, PENDING_UPDATE
)
