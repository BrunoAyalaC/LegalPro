package com.legalpro.app.di

import android.content.Context
import androidx.room.Room
import com.legalpro.app.data.local.dao.EscritoDao
import com.legalpro.app.data.local.dao.ExpedienteDao
import com.legalpro.app.data.local.database.AppDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Módulo de inyección de dependencias con Hilt para proveer la base de datos de Room y sus DAOs.
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private const val DATABASE_NAME = "legalpro_local_db"

    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            DATABASE_NAME
        )
        // En desarrollo, podríamos usar fallbackToDestructiveMigration si hay cambios frecuentes de esquema
        .fallbackToDestructiveMigration()
        .build()
    }

    @Provides
    @Singleton
    fun provideEscritoDao(database: AppDatabase): EscritoDao {
        return database.escritoDao()
    }

    @Provides
    @Singleton
    fun provideExpedienteDao(database: AppDatabase): ExpedienteDao {
        return database.expedienteDao()
    }
}
