package com.legalpro.app.presentation.theme

import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Sistema responsivo multi-breakpoint para LegalPro.
 *
 * Breakpoints de ancho:
 *   COMPACT  < 400dp  — phones pequeños (Galaxy A, Pixel 4a)
 *   MEDIUM   400–599dp — phones normales (Pixel 7, Galaxy S23)
 *   LARGE    600–839dp — tablets pequeños / phones en landscape (Galaxy Tab A8, Pixel Fold)
 *   EXPANDED ≥ 840dp  — tablets grandes (Galaxy Tab S8, Pixel Tablet)
 *
 * Landscape: se detecta con screenHeightDp < screenWidthDp
 */
object ResponsiveValues {

    private enum class WindowWidth { COMPACT, MEDIUM, LARGE, EXPANDED }

    @Composable
    private fun windowWidth(): WindowWidth {
        val w = LocalConfiguration.current.screenWidthDp
        return when {
            w >= 840 -> WindowWidth.EXPANDED
            w >= 600 -> WindowWidth.LARGE
            w >= 400 -> WindowWidth.MEDIUM
            else -> WindowWidth.COMPACT
        }
    }

    @Composable
    fun isLandscape(): Boolean {
        val config = LocalConfiguration.current
        return config.orientation == Configuration.ORIENTATION_LANDSCAPE
    }

    @Composable
    fun isTablet(): Boolean = windowWidth() >= WindowWidth.LARGE

    // ─── Logo ─────────────────────────────────────────────────────────────
    @Composable
    fun getLogoSize(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 64.dp
        WindowWidth.LARGE    -> 56.dp
        WindowWidth.MEDIUM   -> 40.dp
        WindowWidth.COMPACT  -> 36.dp
    }

    // ─── Header hero (imágenes de fondo de pantallas de herramientas) ─────
    @Composable
    fun getHeroHeight(): Dp {
        if (isLandscape()) return 100.dp
        return when (windowWidth()) {
            WindowWidth.EXPANDED -> 220.dp
            WindowWidth.LARGE    -> 160.dp
            WindowWidth.MEDIUM   -> 140.dp
            WindowWidth.COMPACT  -> 120.dp
        }
    }

    // ─── Altura de header toolbar ─────────────────────────────────────────
    @Composable
    fun getHeaderHeight(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 80.dp
        WindowWidth.LARGE    -> 72.dp
        else                 -> 64.dp
    }

    // ─── Botón principal CTA ──────────────────────────────────────────────
    @Composable
    fun getButtonHeight(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 60.dp
        WindowWidth.LARGE    -> 56.dp
        WindowWidth.MEDIUM   -> 52.dp
        WindowWidth.COMPACT  -> 48.dp
    }

    // ─── TextField multi-línea ────────────────────────────────────────────
    @Composable
    fun getTextFieldHeight(): Dp {
        if (isLandscape()) return 100.dp
        return when (windowWidth()) {
            WindowWidth.EXPANDED -> 200.dp
            WindowWidth.LARGE    -> 180.dp
            WindowWidth.MEDIUM   -> 140.dp
            WindowWidth.COMPACT  -> 120.dp
        }
    }

    // ─── TextField input corto ────────────────────────────────────────────
    @Composable
    fun getTextFieldShortHeight(): Dp {
        if (isLandscape()) return 80.dp
        return when (windowWidth()) {
            WindowWidth.EXPANDED -> 140.dp
            WindowWidth.LARGE    -> 120.dp
            WindowWidth.MEDIUM   -> 100.dp
            WindowWidth.COMPACT  -> 90.dp
        }
    }

    // ─── Tipografía ───────────────────────────────────────────────────────
    @Composable
    fun getTitleFontSize(): TextUnit = when (windowWidth()) {
        WindowWidth.EXPANDED -> 26.sp
        WindowWidth.LARGE    -> 24.sp
        WindowWidth.MEDIUM   -> 20.sp
        WindowWidth.COMPACT  -> 18.sp
    }

    @Composable
    fun getSubtitleFontSize(): TextUnit = when (windowWidth()) {
        WindowWidth.EXPANDED -> 18.sp
        WindowWidth.LARGE    -> 16.sp
        else                 -> 14.sp
    }

    @Composable
    fun getBodyFontSize(): TextUnit = when (windowWidth()) {
        WindowWidth.EXPANDED -> 16.sp
        WindowWidth.LARGE    -> 15.sp
        else                 -> 14.sp
    }

    // ─── Iconos ───────────────────────────────────────────────────────────
    @Composable
    fun getIconSize(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 36.dp
        WindowWidth.LARGE    -> 32.dp
        WindowWidth.MEDIUM   -> 24.dp
        WindowWidth.COMPACT  -> 22.dp
    }

    // ─── Padding / spacing ────────────────────────────────────────────────
    @Composable
    fun getPaddingSmall(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 24.dp
        WindowWidth.LARGE    -> 20.dp
        WindowWidth.MEDIUM   -> 16.dp
        WindowWidth.COMPACT  -> 12.dp
    }

    @Composable
    fun getPaddingMedium(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 40.dp
        WindowWidth.LARGE    -> 32.dp
        WindowWidth.MEDIUM   -> 24.dp
        WindowWidth.COMPACT  -> 16.dp
    }

    @Composable
    fun getSpacingSmall(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 16.dp
        WindowWidth.LARGE    -> 12.dp
        WindowWidth.MEDIUM   -> 8.dp
        WindowWidth.COMPACT  -> 6.dp
    }

    @Composable
    fun getSpacingLarge(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 48.dp
        WindowWidth.LARGE    -> 32.dp
        WindowWidth.MEDIUM   -> 24.dp
        WindowWidth.COMPACT  -> 16.dp
    }

    @Composable
    fun getCardPadding(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 28.dp
        WindowWidth.LARGE    -> 24.dp
        WindowWidth.MEDIUM   -> 16.dp
        WindowWidth.COMPACT  -> 12.dp
    }

    // ─── Columnas de grid ─────────────────────────────────────────────────
    @Composable
    fun getColumnWidth(): Float = when (windowWidth()) {
        WindowWidth.EXPANDED -> 0.33f // 3 columnas
        WindowWidth.LARGE    -> 0.5f  // 2 columnas
        else                 -> 1f    // 1 columna
    }

    // Número de columnas para LazyVerticalGrid
    @Composable
    fun getGridColumns(): Int = when (windowWidth()) {
        WindowWidth.EXPANDED -> 3
        WindowWidth.LARGE    -> 2
        else                 -> 1
    }

    // ─── Padding lateral de pantalla (margen horizontal seguro) ──────────
    @Composable
    fun getScreenHorizontalPadding(): Dp = when (windowWidth()) {
        WindowWidth.EXPANDED -> 48.dp
        WindowWidth.LARGE    -> 32.dp
        WindowWidth.MEDIUM   -> 16.dp
        WindowWidth.COMPACT  -> 12.dp
    }
}
