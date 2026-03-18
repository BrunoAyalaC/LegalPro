package com.legalpro.app.di

import com.legalpro.app.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.RealtimeChannel
import io.ktor.client.HttpClient
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SupabaseModule {

    @Provides
    @Singleton
    fun provideSupabaseClient(): SupabaseClient {
        return createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY
        ) {
            // Motor HTTP robusto con timeouts explícitos
            httpEngine = OkHttp.create {
                config {
                    connectTimeout(15, TimeUnit.SECONDS)
                    readTimeout(30, TimeUnit.SECONDS)
                    writeTimeout(30, TimeUnit.SECONDS)
                    retryOnConnectionFailure(true)
                }
            }

            install(Auth) {
                flowType = FlowType.PKCE
                alwaysAutoRefresh = true
                // Clave en EncryptedSharedPreferences — gestionado por SessionManager
                autoSaveToStorage = true
            }

            install(Postgrest) {
                defaultSchema = "public"
            }

            install(Storage) {
                // Transferencias de hasta 50 MB (evidencia digital)
                transferTimeout = 120.seconds
            }

            install(Realtime) {
                reconnectDelay = 5.seconds
            }
        }
    }
}