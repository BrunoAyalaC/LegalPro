package com.legalpro.app.data.local.model

import androidx.room.Embedded
import androidx.room.Relation
import com.legalpro.app.data.local.entity.EscritoEntity
import com.legalpro.app.data.local.entity.ExpedienteActuacionEntity
import com.legalpro.app.data.local.entity.ExpedienteEntity

/**
 * Modelo relacional que agrupa un expediente con todo su historial de actuaciones
 * y con todos los escritos redactados por la IA para el mismo.
 */
data class ExpedienteDetalle(
    @Embedded
    val expediente: ExpedienteEntity,

    @Relation(
        parentColumn = "id",
        entityColumn = "expedienteId"
    )
    val actuaciones: List<ExpedienteActuacionEntity> = emptyList(),

    @Relation(
        parentColumn = "id",
        entityColumn = "expedienteId"
    )
    val escritos: List<EscritoEntity> = emptyList()
)
