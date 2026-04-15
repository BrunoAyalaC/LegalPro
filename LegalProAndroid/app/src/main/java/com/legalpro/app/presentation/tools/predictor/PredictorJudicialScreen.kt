package com.legalpro.app.presentation.tools.predictor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalConfiguration
import androidx.hilt.navigation.compose.hiltViewModel
import com.legalpro.app.presentation.theme.*
import com.legalpro.app.presentation.components.ToolWizardDialog
import com.legalpro.app.presentation.components.WizardStep
import com.legalpro.app.presentation.components.SpriteIcon
import com.legalpro.app.presentation.components.SpriteA
import com.legalpro.app.R

@Composable
fun PredictorJudicialScreen() {
    // Responsive Values
    val paddingSmall = ResponsiveValues.getPaddingSmall()
    val paddingMedium = ResponsiveValues.getPaddingMedium()
    val bodyFontSize = ResponsiveValues.getBodyFontSize()
    val spacingSmall = ResponsiveValues.getSpacingSmall()

    val viewModel: PredictorViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsState()

    var showWizard by remember { mutableStateOf(true) }
    val wizardSteps = listOf(
        WizardStep("Resumen del Caso", "Describe brevemente los hechos del caso y el delito imputado. Cuantos más detalles proporciones, más precisa será la IA.", R.drawable.sprite_a, SpriteA.PASTE),
        WizardStep("Juez Asignado", "Ingresa el nombre del juez o la sala (opcional). La IA tomará en cuenta su historial si está disponible.", R.drawable.sprite_a, SpriteA.GAVEL_NAV),
        WizardStep("Predicción Inteligente", "Analizaremos jurisprudencia similar para darte una probabilidad de éxito y desglosaremos los factores a tu favor o en contra.", R.drawable.sprite_a, SpriteA.TRENDING)
    )

    if (showWizard) {
        ToolWizardDialog(
            toolName = "Predictor Judicial de Resultados",
            steps = wizardSteps,
            onDismissRequest = { showWizard = false }
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(paddingSmall).verticalScroll(rememberScrollState())
    ) {
        val textFieldHeight = ResponsiveValues.getTextFieldShortHeight()
        val buttonHeight = ResponsiveValues.getButtonHeight()
        OutlinedTextField(
            value = uiState.hechosCausa,
            onValueChange = { viewModel.updateHechosCausa(it) },
            modifier = Modifier.fillMaxWidth().height(textFieldHeight),
            label = { Text("Breve descripción del caso y delito", color = Color.Gray) },
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue
            ),
            maxLines = 4
        )
        
        Spacer(modifier = Modifier.height(spacingSmall))

        OutlinedTextField(
            value = uiState.juezAsignado,
            onValueChange = { viewModel.updateJuezAsignado(it) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Juez / Sala Asignada (Opcional)", color = Color.Gray) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue
            )
        )

        Spacer(modifier = Modifier.height(paddingSmall))

        Button(
            onClick = { viewModel.predecirResultado() },
            modifier = Modifier.fillMaxWidth().height(buttonHeight),
            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
            enabled = !uiState.isLoading
        ) {
            if (uiState.isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
            else Text("Analizar Probabilidades (IA)", fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(paddingMedium))

        if (uiState.error != null) {
            Text(uiState.error!!, color = WarningAmber, fontWeight = FontWeight.Bold)
        }

        if (uiState.probabilidadExito != null) {
            val progressVal = uiState.probabilidadExito!! / 100f
            val colorProgreso = if (uiState.probabilidadExito!! >= 70) SuccessEmerald else if (uiState.probabilidadExito!! >= 40) WarningAmber else ErrorRed
            
            Box(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(SurfaceDark).padding(paddingMedium),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Probabilidad de Éxito", color = Color.Gray, fontSize = bodyFontSize, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(paddingSmall))
                    Box(
                        modifier = Modifier.size(150.dp).clip(CircleShape).background(BackgroundDark),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            progress = { progressVal },
                            modifier = Modifier.fillMaxSize(),
                            color = colorProgreso,
                            strokeWidth = 12.dp,
                            trackColor = BorderDark,
                        )
                        Text("${uiState.probabilidadExito}%", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(paddingSmall))
                    Text(uiState.veredictoGeneral ?: "", color = colorProgreso, fontSize = bodyFontSize, fontWeight = FontWeight.SemiBold)
                }
            }

            if (uiState.factoresAnalizados.isNotEmpty()) {
                Spacer(modifier = Modifier.height(paddingSmall))
                Text("Factores Analizados (Gemini)", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(spacingSmall))
                
                uiState.factoresAnalizados.forEach { factor ->
                    val factorColor = when(factor.tipo) {
                        "Favorable" -> SuccessEmerald
                        "Desfavorable" -> ErrorRed
                        else -> WarningAmber
                    }
                    val iconText = when(factor.tipo) {
                        "Favorable" -> "✓ "
                        "Desfavorable" -> "✗ "
                        else -> "! "
                    }
                    Text(iconText + factor.descripcion, color = factorColor, fontSize = 12.sp, modifier = Modifier.padding(vertical = 4.dp))
                }
            }
        }
    }
}
