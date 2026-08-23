package com.legalpro.app.data.local.dao

import androidx.room.*
import com.legalpro.app.data.local.entity.EscritoEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object (DAO) para la tabla 'escritos'.
 */
@Dao
interface EscritoDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEscrito(escrito: EscritoEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEscritos(escritos: List<EscritoEntity>)

    @Update
    suspend fun updateEscrito(escrito: EscritoEntity)

    @Delete
    suspend fun deleteEscrito(escrito: EscritoEntity)

    @Query("DELETE FROM escritos WHERE id = :id")
    suspend fun deleteEscritoById(id: String)

    @Query("SELECT * FROM escritos ORDER BY fechaActualizacion DESC")
    fun getAllEscritosFlow(): Flow<List<EscritoEntity>>

    @Query("SELECT * FROM escritos WHERE id = :id LIMIT 1")
    fun getEscritoByIdFlow(id: String): Flow<EscritoEntity?>

    @Query("SELECT * FROM escritos WHERE id = :id LIMIT 1")
    suspend fun getEscritoById(id: String): EscritoEntity?

    @Query("SELECT * FROM escritos WHERE expedienteId = :expedienteId ORDER BY fechaCreacion DESC")
    fun getEscritosByExpedienteFlow(expedienteId: String): Flow<List<EscritoEntity>>

    // Operaciones para sincronización Offline-First
    @Query("SELECT * FROM escritos WHERE estadoSincronizacion != 'SYNCED'")
    suspend fun getEscritosPendientesSincronizacion(): List<EscritoEntity>

    @Query("UPDATE escritos SET estadoSincronizacion = :nuevoEstado WHERE id = :id")
    suspend fun actualizarEstadoSincronizacion(id: String, nuevoEstado: String)

    @Query("SELECT * FROM escritos WHERE titulo LIKE '%' || :query || '%' OR contenido LIKE '%' || :query || '%'")
    fun buscarEscritos(query: String): Flow<List<EscritoEntity>>
}
