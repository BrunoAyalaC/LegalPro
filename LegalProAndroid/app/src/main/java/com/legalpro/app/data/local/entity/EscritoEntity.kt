package com.legalpro.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Entidad que representa un escrito legal generado por la IA en la base de datos local.
 * Soporta almacenamiento offline y estados de sincronización.
 */
@Entity(tableName = "escritos")
data class EscritoEntity(
    @PrimaryKey
    val id: String, // UUID generado localmente o proveniente del backend
    val titulo: String,
    val contenido: String,
    val tipoEscrito: String, // Ejemplo: DEMANDA, APELACION, CONTESTACION, ALEGATO
    val materia: String, // Ejemplo: PENAL, CIVIL, LABORAL, FAMILIA
    val expedienteId: String?, // Relación opcional con un expediente físico/digital
    val juzgado: String?,
    val clienteNombre: String?,
    val contraparteNombre: String?,
    val promptOriginal: String?, // El prompt utilizado para la generación de la IA
    val modeloIa: String?, // Ejemplo: "gpt-4o", "claude-3-5-sonnet"
    val tokenCount: Int?,
    
    // Control de sincronización con Supabase / Servidor backend
    val estadoSincronizacion: String, // SYNCED, PENDING_CREATE, PENDING_UPDATE, PENDING_DELETE
    
    // Tiempos en timestamp (milisegundos)
    val fechaCreacion: Long,
    val fechaActualizacion: Long
)
