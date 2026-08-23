package com.legalpro.app.presentation.tools.reports

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
import androidx.hilt.navigation.compose.hiltViewModel
import com.legalpro.app.presentation.theme.*

@Composable
fun GeneradorCasosCriticosScreen() {
    Column(modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(16.dp)) {
        Text("Detector de Casos Críticos (IA)", color = ErrorRed, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))
        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(ErrorRed.copy(0.1f)).padding(16.dp)) {
            Text("ALERTA: El Expediente 0145-2022 está a 48 horas de prescribir su acción penal.", color = ErrorRed, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// ═══════════════════════════════════════════════════════
// RESUMEN EJECUTIVO DEL CASO
// ═══════════════════════════════════════════════════════
@Composable
fun ResumenEjecutivoScreen() {
    val viewModel: ResumenCasoViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            "Resumen Ejecutivo de Caso",
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            "Genera un brief ejecutivo para reuniones con cliente o directorio",
            color = Color.Gray,
            fontSize = 12.sp
        )

        Spacer(modifier = Modifier.height(16.dp))

        val textFieldHeight = ResponsiveValues.getTextFieldHeight()
        val buttonHeight = ResponsiveValues.getButtonHeight()
        OutlinedTextField(
            value = uiState.textoExpediente,
            onValueChange = { viewModel.updateTextoExpediente(it) },
            modifier = Modifier.fillMaxWidth().height(textFieldHeight),
            label = { Text("Pega aquí el texto del expediente o caso", color = Color.Gray) },
            maxLines = 10,
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue
            )
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = { viewModel.resumirCaso() },
            modifier = Modifier.fillMaxWidth().height(buttonHeight),
            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
            enabled = !uiState.isLoading && uiState.textoExpediente.isNotBlank()
        ) {
            if (uiState.isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
            else Text("Resumir Caso (IA)", fontWeight = FontWeight.Bold)
        }

        if (uiState.error != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(uiState.error!!, color = ErrorRed, fontWeight = FontWeight.Bold)
        }

        if (uiState.resumenEjecutivo != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceDark)
                    .padding(16.dp)
            ) {
                Column {
                    Text(
                        "RESUMEN EJECUTIVO",
                        color = PrimaryBlue,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(uiState.resumenEjecutivo!!, color = Color.LightGray, fontSize = 13.sp, lineHeight = 20.sp)

                    if (uiState.puntosClave.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = BorderDark)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "PUNTOS CLAVE",
                            color = SuccessEmerald,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        uiState.puntosClave.forEach { punto ->
                            Row(modifier = Modifier.padding(vertical = 3.dp)) {
                                Text("• ", color = SuccessEmerald, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Text(punto, color = Color.White, fontSize = 13.sp, lineHeight = 18.sp)
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun ReporteRetroalimentacionScreen() {
    Column(modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(16.dp)) {
        Text("Retroalimentación de Audiencia", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))
        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(SurfaceDark).padding(16.dp)) {
            Text("Gemini evaluó tu transcripción de la audiencia de ayer. Tu tono fue adecuado (8/10), pero las objeciones faltaron en la fase de interrogatorio.", color = WarningAmber, fontSize = 14.sp)
        }
    }
}

@Composable
fun ConfigEspecialidadScreen() {
    Column(modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(16.dp)) {
        Text("Ajustar Motor IA por Especialidad", color = PrimaryLight, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))
        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(SurfaceDark).padding(16.dp)) {
            Text("Fijando el contexto global del LLM a Derecho Corporativo y Tributario Peruano.", color = Color.White, fontSize = 14.sp)
        }
    }
}
