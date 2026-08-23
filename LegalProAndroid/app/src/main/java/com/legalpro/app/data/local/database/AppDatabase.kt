package com.legalpro.app.data.local.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.legalpro.app.data.local.dao.EscritoDao
import com.legalpro.app.data.local.dao.ExpedienteDao
import com.legalpro.app.data.local.entity.EscritoEntity
import com.legalpro.app.data.local.entity.ExpedienteActuacionEntity
import com.legalpro.app.data.local.entity.ExpedienteEntity

/**
 * Base de datos principal de la aplicación LegalPro utilizando Room.
 * Almacena escritos generados por IA, expedientes judiciales y actuaciones para soporte offline completo.
 */
@Database(
    entities = [
        EscritoEntity::class,
        ExpedienteEntity::class,
        ExpedienteActuacionEntity::class
    ],
    version = 1,
    exportSchema = false // Cambiar a true en producción para control de migraciones
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun escritoDao(): EscritoDao
    abstract fun expedienteDao(): ExpedienteDao

    companion object {
        private const val DATABASE_NAME = "legalpro_local_db"

        @Volatile
        private var INSTANCE: AppDatabase? = null

        /**
         * Método auxiliar para instanciar la base de datos de manera manual
         * (útil si no se está usando inyección de dependencias en algún módulo de testing).
         */
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                )
                // En una app real, es aconsejable configurar estrategias de migración:
                // .fallbackToDestructiveMigration() // Solo para desarrollo
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
