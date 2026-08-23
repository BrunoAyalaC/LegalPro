/**
 * RagModule - Dependency injection for the RAG feature.
 *
 * `RagRepository` is bound automatically via its `@Inject constructor` +
 * `@Singleton` annotation, so Hilt provides it without an explicit
 * `@Provides`. This module is kept as a future extension point (e.g. a
 * shared `Gson` instance or a telemetry wrapper) without forcing the
 * repository to receive an extra parameter today.
 *
 * @author @android
 * @version 1.0.0
 * @date 2026-08-01
 */

package com.legalpro.app.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object RagModule {
    // RagRepository uses constructor injection (@Inject + @Singleton),
    // so Hilt provides it automatically through NetworkModule (LegalProApi).
    // No explicit @Provides is required at this time.
}
