package com.legalpro.app.presentation.auth

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.legalpro.app.R
import com.legalpro.app.presentation.theme.ResponsiveValues
import kotlinx.coroutines.delay

/* ═══ Paleta Design System 06-J ════════════════════════════════ */
private val CyanBrand  = Color(0xFF06B6D4)
private val GoldBrand  = Color(0xFFC9A84C)
private val BgDeep     = Color(0xFF050508)
private val BgCard     = Color(0xFF0F1620)
private val TextWhite  = Color.White
private val TextMuted  = Color(0xFF8899AA)

/* ═══ Datos de slides de onboarding ═══════════════════════════ */
data class OnboardingSlide(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val tag: String,
    val headline: String,
    val body: String,
    val stat: String,
    val statLabel: String,
    val isGold: Boolean = false,
)

private val ONBOARDING_SLIDES = listOf(
    OnboardingSlide(
        icon = Icons.Default.Psychology,
        tag = "ANÁLISIS IA",
        headline = "Expedientes analizados\nen segundos",
        body = "Gemini AI extrae hechos, argumentos y puntos débiles de cualquier PDF legal en menos de 30 segundos.",
        stat = "30s", statLabel = "tiempo de análisis",
    ),
    OnboardingSlide(
        icon = Icons.Default.Balance,
        tag = "PREDICCIÓN JUDICIAL",
        headline = "Conoce el resultado\nantes del juicio",
        body = "Analiza más de 50,000 sentencias del Poder Judicial peruano y predice el resultado con fundamento jurídico.",
        stat = "94%", statLabel = "de precisión", isGold = true,
    ),
    OnboardingSlide(
        icon = Icons.Default.Gavel,
        tag = "SIMULADOR NCPP",
        headline = "Practica audiencias\ncon IA como juez",
        body = "Juicio oral simulado donde la IA actúa como juez, fiscal y abogado defensor. Perfecciona tu estrategia sin riesgo.",
        stat = "4", statLabel = "roles de IA",
    ),
    OnboardingSlide(
        icon = Icons.Default.EditNote,
        tag = "REDACCIÓN LEGAL",
        headline = "Escritos NCPP/CPC\nen minutos",
        body = "Genera demandas, apelaciones, recursos de nulidad y requerimientos fiscales con lenguaje jurídico correcto.",
        stat = "13", statLabel = "tipos de escritos", isGold = true,
    ),
)

/* ═══ Composable: Slide individual ════════════════════════════ */
@Composable
private fun OnboardingSlideContent(slide: OnboardingSlide) {
    val accent = if (slide.isGold) GoldBrand else CyanBrand
    val accentAlpha12 = accent.copy(alpha = 0.12f)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        /* Tag */
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(accent)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = slide.tag,
                fontSize = 10.sp,
                fontWeight = FontWeight.ExtraBold,
                color = accent,
                letterSpacing = 2.sp,
            )
        }

        Spacer(Modifier.height(20.dp))

        /* Icon circle */
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(accentAlpha12)
                .then(
                    Modifier.background(
                        Brush.radialGradient(
                            listOf(accent.copy(0.08f), Color.Transparent),
                            radius = 120f,
                            center = Offset(36f, 36f),
                        )
                    )
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = slide.icon,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(36.dp),
            )
        }

        Spacer(Modifier.height(20.dp))

        /* Headline */
        Text(
            text = slide.headline,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            color = TextWhite,
            textAlign = TextAlign.Center,
            lineHeight = 28.sp,
        )

        Spacer(Modifier.height(12.dp))

        /* Body */
        Text(
            text = slide.body,
            fontSize = 13.sp,
            color = TextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp,
        )

        Spacer(Modifier.height(20.dp))

        /* Stat badge */
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(accentAlpha12)
                .padding(horizontal = 18.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = slide.stat,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                color = accent,
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = slide.statLabel,
                fontSize = 12.sp,
                color = TextMuted,
            )
        }
    }
}

/* ═══ Dot indicators ══════════════════════════════════════════ */
@Composable
private fun PagerDots(currentPage: Int, pageCount: Int) {
    Row(
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(pageCount) { i ->
            val width by animateDpAsState(
                targetValue = if (i == currentPage) 20.dp else 6.dp,
                animationSpec = tween(300),
                label = "dot_width_$i",
            )
            val alpha by animateFloatAsState(
                targetValue = if (i == currentPage) 1f else 0.25f,
                animationSpec = tween(300),
                label = "dot_alpha_$i",
            )
            Box(
                modifier = Modifier
                    .padding(horizontal = 3.dp)
                    .size(width = width, height = 6.dp)
                    .clip(CircleShape)
                    .background(CyanBrand.copy(alpha = alpha))
            )
        }
    }
}

/* ═══ LOGIN SCREEN PRINCIPAL ═══════════════════════════════════ */
@Composable
fun LoginScreen(
    onNavigateToDashboard: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val state by viewModel.viewState.collectAsState()
    val focusManager = LocalFocusManager.current
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is LoginContract.Effect.NavigateToDashboard -> onNavigateToDashboard()
                is LoginContract.Effect.NavigateToRegister  -> {}
                is LoginContract.Effect.ShowError           -> errorMessage = effect.message
            }
        }
    }

    /* Pager state para los slides */
    val pagerState = rememberPagerState(pageCount = { ONBOARDING_SLIDES.size })

    /* Auto-advance cada 4 segundos */
    LaunchedEffect(pagerState.currentPage) {
        delay(4000L)
        val next = (pagerState.currentPage + 1) % ONBOARDING_SLIDES.size
        pagerState.animateScrollToPage(next)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BgDeep),
    ) {
        /* Fondo decorativo radial */
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(Color(0xFF062040).copy(0.6f), Color.Transparent),
                        radius = 800f,
                        center = Offset(0f, 0f),
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(ResponsiveValues.getPaddingMedium()))

            /* ── Logo ─────────────────────────────────────────── */
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(CyanBrand.copy(0.10f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.logo_lexia),
                    contentDescription = "Lex.ia",
                    modifier = Modifier.size(48.dp),
                    tint = Color.Unspecified,
                )
            }

            Spacer(Modifier.height(12.dp))

            Text(
                text = "Lex.ia",
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TextWhite,
                letterSpacing = (-0.5).sp,
            )
            Text(
                text = "Plataforma Legal con IA · Perú",
                fontSize = 12.sp,
                color = TextMuted,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(32.dp))

            /* ── ONBOARDING SLIDES ────────────────────────────── */
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = BgCard),
                elevation = CardDefaults.cardElevation(0.dp),
            ) {
                Column(
                    modifier = Modifier.padding(top = 24.dp, bottom = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp),
                    ) { page ->
                        OnboardingSlideContent(slide = ONBOARDING_SLIDES[page])
                    }

                    Spacer(Modifier.height(20.dp))

                    PagerDots(
                        currentPage = pagerState.currentPage,
                        pageCount = ONBOARDING_SLIDES.size,
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            /* ── FORMULARIO DE LOGIN ──────────────────────────── */
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = BgCard),
                elevation = CardDefaults.cardElevation(0.dp),
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text(
                        text = "Iniciar Sesión",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextWhite,
                    )

                    /* Email */
                    OutlinedTextField(
                        value = state.email,
                        onValueChange = { viewModel.setEvent(LoginContract.Event.EmailChanged(it)) },
                        label = { Text("Correo electrónico", color = TextMuted) },
                        leadingIcon = {
                            Icon(Icons.Default.Email, contentDescription = null, tint = CyanBrand)
                        },
                        isError = state.emailError != null,
                        supportingText = state.emailError?.let { msg ->
                            { Text(msg, color = MaterialTheme.colorScheme.error) }
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next,
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = outlinedFieldColors(),
                    )

                    /* Contraseña */
                    OutlinedTextField(
                        value = state.password,
                        onValueChange = { viewModel.setEvent(LoginContract.Event.PasswordChanged(it)) },
                        label = { Text("Contraseña", color = TextMuted) },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null, tint = CyanBrand)
                        },
                        trailingIcon = {
                            IconButton(onClick = {
                                viewModel.setEvent(LoginContract.Event.TogglePasswordVisibility)
                            }) {
                                Icon(
                                    imageVector = if (state.isPasswordVisible)
                                        Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (state.isPasswordVisible)
                                        "Ocultar contraseña" else "Mostrar contraseña",
                                    tint = TextMuted,
                                )
                            }
                        },
                        visualTransformation = if (state.isPasswordVisible)
                            VisualTransformation.None else PasswordVisualTransformation(),
                        isError = state.passwordError != null,
                        supportingText = state.passwordError?.let { msg ->
                            { Text(msg, color = MaterialTheme.colorScheme.error) }
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.setEvent(LoginContract.Event.LoginClicked)
                            }
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = outlinedFieldColors(),
                    )

                    /* Error banner */
                    errorMessage?.let { msg ->
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = Color(0xFFD32F2F).copy(alpha = 0.12f)
                            ),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Icon(Icons.Default.ErrorOutline, contentDescription = null,
                                    tint = Color(0xFFEF5350), modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(msg, color = Color(0xFFEF5350), fontSize = 13.sp, modifier = Modifier.weight(1f))
                                TextButton(onClick = { errorMessage = null }) {
                                    Text("✕", color = Color(0xFFEF5350), fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    /* Botón Ingresar */
                    Button(
                        onClick = { viewModel.setEvent(LoginContract.Event.LoginClicked) },
                        enabled = !state.isLoading,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CyanBrand,
                            disabledContainerColor = CyanBrand.copy(alpha = 0.4f),
                        ),
                    ) {
                        if (state.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = TextWhite,
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Icon(Icons.Default.Login, contentDescription = null,
                                tint = TextWhite, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Ingresar", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                        }
                    }
                }
            }

            Spacer(Modifier.height(28.dp))

            Text(
                text = "© 2026 Lex.ia · Plataforma Legal Peruana · Gemini AI",
                fontSize = 11.sp,
                color = TextMuted.copy(alpha = 0.5f),
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(32.dp))
        }
    }
}

/* ─── Helper: colores consistentes para OutlinedTextField ──── */
@Composable
private fun outlinedFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = CyanBrand,
    unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
    focusedTextColor = TextWhite,
    unfocusedTextColor = TextWhite.copy(alpha = 0.85f),
    cursorColor = CyanBrand,
    focusedLabelColor = CyanBrand,
)
