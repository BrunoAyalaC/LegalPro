package com.legalpro.app.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidad que representa una actuación, evento o notificación dentro del historial de un expediente.
 * Cuenta con claves foráneas referenciando al expediente correspondiente.
 */
@Entity(
    tableName = "expediente_actuaciones",
    foreignKeys = [
        ForeignKey(
            entity = ExpedienteEntity::class,
            parentColumns = ["id"],
            childColumns = ["expedienteId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["expedienteId"])]
)
data class ExpedienteActuacionEntity(
    @PrimaryKey
    val id: String, // ID único de la actuación (generalmente de backend o SINOE)
    val expedienteId: String, // Relación con el expediente
    val nroResolucion: String?, // Ejemplo: "RESOLUCION NRO. 04"
    val fechaResolucion: Long, // Timestamp de la fecha de emisión
    val fechaNotificacion: Long?, // Timestamp de la fecha de notificación (si aplica)
    val tipoActuacion: String, // RESOLUCION, DECRETO, AUTO, SENTENCIA, ESCRITO, NOTIFICACION
    val sumilla: String, // Título o resumen corto
    val descripcion: String, // Detalle completo de la resolución o proveído
    val resolucionContenidoUrl: String?, // Ruta/URL al documento PDF adjunto
    
    // Simplificación de jerga jurídica procesada por la IA para el cliente o abogado
    val resumenIaActuacion: String?,
    
    val fechaCreacionLocal: Long
)
