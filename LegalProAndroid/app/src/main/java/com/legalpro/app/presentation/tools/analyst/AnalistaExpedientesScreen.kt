package com.legalpro.app.presentation.tools.analyst

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalConfiguration
import androidx.hilt.navigation.compose.hiltViewModel
import com.legalpro.app.R
import com.legalpro.app.presentation.components.SpriteIcon
import com.legalpro.app.presentation.components.SpriteA
import com.legalpro.app.presentation.theme.*
import com.legalpro.app.presentation.components.ToolWizardDialog
import com.legalpro.app.presentation.components.WizardStep

@Composable
fun AnalistaExpedientesScreen() {
    // Responsive Values
    val paddingSmall = ResponsiveValues.getPaddingSmall()
    val paddingMedium = ResponsiveValues.getPaddingMedium()
    val titleFontSize = ResponsiveValues.getTitleFontSize()
    val bodyFontSize = ResponsiveValues.getBodyFontSize()
    val spacingSmall = ResponsiveValues.getSpacingSmall()

    val viewModel: AnalistaExpedientesViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsState()

    var showWizard by remember { mutableStateOf(true) }
    val wizardSteps = listOf(
        WizardStep("Carga el Expediente", "Pega el texto del documento legal, folio o resolución que deseas auditar. El sistema lo leerá completo.", R.drawable.sprite_a, SpriteA.PASTE),
        WizardStep("Análisis Criminológico", "Nuestra IA revisará a fondo cada declaración y hecho buscando fisuras, errores procesales o contradicciones.", R.drawable.sprite_a, SpriteA.FACT_CHECK),
        WizardStep("Aprovecha los Errores", "Obtendrás un panel de alertas rojas o ámbar con la descripción exacta del error hallado para que lo uses en tu defensa.", R.drawable.sprite_a, SpriteA.SPEED)
    )

    if (showWizard) {
        ToolWizardDialog(
            toolName = "Auditor de Expedientes",
            steps = wizardSteps,
            onDismissRequest = { showWizard = false }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(paddingSmall)
            .verticalScroll(rememberScrollState())
    ) {
        val textFieldHeight = ResponsiveValues.getTextFieldShortHeight()
        val buttonHeight = ResponsiveValues.getButtonHeight()
        OutlinedTextField(
            value = uiState.textoExpediente,
            onValueChange = { viewModel.updateTextoExpediente(it) },
            modifier = Modifier.fillMaxWidth().height(textFieldHeight),
            label = { Text("Pega aquí el texto del expediente / folio a analizar", color = Color.Gray) },
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue
            ),
            maxLines = 8
        )
        
        Spacer(modifier = Modifier.height(paddingMedium))

        Button(
            onClick = { viewModel.analizarExpediente() },
            modifier = Modifier.fillMaxWidth().height(buttonHeight),
            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
            enabled = !uiState.isLoading && uiState.textoExpediente.isNotBlank()
        ) {
            if (uiState.isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
            else Text("Auditar Expediente (IA)", fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(paddingMedium))

        if (uiState.error != null) {
            Text(uiState.error!!, color = WarningAmber, fontWeight = FontWeight.Bold)
        }

        if (uiState.resumenGeneral != null) {
            // Document Viewer
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceDark)
                    .padding(paddingSmall)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.05f))
                        .padding(paddingSmall)
                ) {
                    Text("RESUMEN GENERAL AUDITADO", color = Color.White, fontSize = bodyFontSize, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(spacingSmall))
                    Text(uiState.resumenGeneral!!, color = Color.LightGray, fontSize = bodyFontSize)
                    
                    if (uiState.anotaciones.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(paddingMedium))
                        HorizontalDivider(color = BorderDark)
                        Spacer(modifier = Modifier.height(paddingMedium))
                        Text("HALLAZGOS Y CONTRADICCIONES", color = Color.White, fontSize = bodyFontSize, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(spacingSmall))

                        uiState.anotaciones.forEach { anotacion ->
                            val (bgColor, tintColor, icon) = when(anotacion.gravedad) {
                                "Alta" -> Triple(ErrorRed.copy(alpha=0.1f), ErrorRed, SpriteA.WARNING)
                                "Media" -> Triple(WarningAmber.copy(alpha=0.1f), WarningAmber, SpriteA.INFO)
                                else -> Triple(PrimaryBlue.copy(alpha=0.1f), PrimaryBlue, SpriteA.CHECK)
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(bgColor)
                                    .padding(spacingSmall)
                            ) {
                                Row {
                                    SpriteIcon(R.drawable.sprite_a, icon, tint = tintColor, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(spacingSmall))
                                    Column {
                                        Text(anotacion.titulo + (anotacion.folioReferencia?.let { " (Folio: $it)" } ?: ""), color = tintColor, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        Text(anotacion.descripcion, color = Color.White, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
