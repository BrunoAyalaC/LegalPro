package com.legalpro.app.data.local.dao

import androidx.room.*
import com.legalpro.app.data.local.entity.ExpedienteActuacionEntity
import com.legalpro.app.data.local.entity.ExpedienteEntity
import com.legalpro.app.data.local.model.ExpedienteDetalle
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object (DAO) para las tablas 'expedientes' y 'expediente_actuaciones'.
 */
@Dao
interface ExpedienteDao {

    // --- Operaciones de Expediente ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpediente(expediente: ExpedienteEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpedientes(expedientes: List<ExpedienteEntity>)

    @Update
    suspend fun updateExpediente(expediente: ExpedienteEntity)

    @Delete
    suspend fun deleteExpediente(expediente: ExpedienteEntity)

    @Query("DELETE FROM expedientes WHERE id = :id")
    suspend fun deleteExpedienteById(id: String)

    @Query("SELECT * FROM expedientes ORDER BY ultimaActualizacionSinoe DESC")
    fun getAllExpedientesFlow(): Flow<List<ExpedienteEntity>>

    @Query("SELECT * FROM expedientes WHERE id = :id LIMIT 1")
    fun getExpedienteByIdFlow(id: String): Flow<ExpedienteEntity?>

    @Query("SELECT * FROM expedientes WHERE id = :id LIMIT 1")
    suspend fun getExpedienteById(id: String): ExpedienteEntity?

    // --- Operaciones de Actuaciones ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertActuaciones(actuaciones: List<ExpedienteActuacionEntity>)

    @Query("DELETE FROM expediente_actuaciones WHERE expedienteId = :expedienteId")
    suspend fun clearActuacionesByExpediente(expedienteId: String)

    @Query("SELECT * FROM expediente_actuaciones WHERE expedienteId = :expedienteId ORDER BY fechaResolucion DESC")
    fun getActuacionesByExpedienteFlow(expedienteId: String): Flow<List<ExpedienteActuacionEntity>>

    // --- Consultas Relacionales Transaccionales ---

    @Transaction
    @Query("SELECT * FROM expedientes WHERE id = :id LIMIT 1")
    fun getExpedienteDetalleByIdFlow(id: String): Flow<ExpedienteDetalle?>

    @Transaction
    @Query("SELECT * FROM expedientes WHERE id = :id LIMIT 1")
    suspend fun getExpedienteDetalleById(id: String): ExpedienteDetalle?

    @Transaction
    @Query("SELECT * FROM expedientes ORDER BY ultimaActualizacionSinoe DESC")
    fun getAllExpedientesConDetalleFlow(): Flow<List<ExpedienteDetalle>>

    // --- Búsqueda ---
    @Query("SELECT * FROM expedientes WHERE numeroExpediente LIKE '%' || :query || '%' OR demandante LIKE '%' || :query || '%' OR demandado LIKE '%' || :query || '%'")
    fun buscarExpedientes(query: String): Flow<List<ExpedienteEntity>>
}
