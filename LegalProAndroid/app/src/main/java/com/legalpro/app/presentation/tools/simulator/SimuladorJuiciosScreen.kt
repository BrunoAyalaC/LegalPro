package com.legalpro.app.presentation.tools.simulator

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.legalpro.app.presentation.components.SpriteB
import com.legalpro.app.R
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale

@Composable
fun SimuladorJuiciosScreen() {
    // Responsive Values
    val paddingSmall = ResponsiveValues.getPaddingSmall()
    val paddingMedium = ResponsiveValues.getPaddingMedium()
    val titleFontSize = ResponsiveValues.getTitleFontSize()
    val bodyFontSize = ResponsiveValues.getBodyFontSize()
    val spacingSmall = ResponsiveValues.getSpacingSmall()
    val heroHeight = ResponsiveValues.getHeroHeight()
    val buttonHeight = ResponsiveValues.getButtonHeight()

    val viewModel: SimuladorJuiciosViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsState()

    var selectedRole by remember { mutableStateOf("Abogado") }
    val roles = listOf("Juez", "Fiscal", "Abogado")
    var userMessage by remember { mutableStateOf("") }
    
    var showWizard by remember { mutableStateOf(true) }
    val wizardSteps = listOf(
        WizardStep("Elige tu Bando", "Selecciona si jugarás como Abogado Defensor, Fiscal o el Juez. La IA asumirá los roles restantes en la audiencia.", R.drawable.sprite_a, SpriteA.GAVEL_NAV),
        WizardStep("Argumenta en Vivo", "Escribe tus alegatos o interrogatorios en el chat. La IA Fiscal intentará rebatir o presentar pruebas falsas (corrupción simulada).", R.drawable.sprite_a, SpriteA.CHAT),
        WizardStep("Sobrevive al Juicio", "Deberás basarte en artículos del Código Penal Peruano reales. Si cometes faltas graves, el Juez IA te descontará puntos.", R.drawable.sprite_b, SpriteB.MILITARY)
    )

    if (showWizard) {
        ToolWizardDialog(
            toolName = "Simulador de Audiencias",
            steps = wizardSteps,
            onDismissRequest = { showWizard = false }
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().background(BackgroundDark)
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(heroHeight)) {
            Image(
                painter = painterResource(id = R.drawable.bg_simulador),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)))
            Text(
                "Simulador de Audiencias",
                color = Color.White,
                fontSize = titleFontSize,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(paddingSmall)
            )
        }
        Column(modifier = Modifier.fillMaxSize().padding(paddingSmall)) {
        if (uiState.simulacionId == null) {
            // Pantalla de Configuración Inicial
            Text("Configura el Universo del Caso", color = Color.White, fontSize = titleFontSize, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(paddingSmall))
            
            Text("Tu Rol en la Audiencia", color = Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(spacingSmall))
            
            Row(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(SurfaceDark).padding(4.dp)
            ) {
                roles.forEach { role ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (selectedRole == role) PrimaryBlue else Color.Transparent)
                            .padding(vertical = paddingSmall)
                            .clickable { selectedRole = role },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(role, color = if (selectedRole == role) Color.White else Color.Gray, fontSize = bodyFontSize, fontWeight = FontWeight.Bold)
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(paddingMedium))
            Button(
                onClick = { viewModel.iniciarSimulacion("Penal", selectedRole, "Juez Corrupto") },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
            ) {
                if (uiState.isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                else Text("Generar Caso y Arrancar IA")
            }
        } else {
            // Pantalla de Interacción del Juicio
            Text("Audiencia en Curso - Puntaje: ${uiState.puntajeActual}", color = SuccessEmerald, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(paddingSmall))
            
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(uiState.mensajes) { msg ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (msg.emisor == selectedRole) PrimaryBlue else SurfaceDark)
                            .padding(spacingSmall)
                    ) {
                        Column {
                            Text(msg.emisor, fontSize = 12.sp, color = if (msg.emisor == selectedRole) Color.LightGray else Color.Gray)
                            Text(msg.mensaje, color = Color.White, fontSize = bodyFontSize)
                        }
                    }
                }
            }
            
            Row(modifier = Modifier.fillMaxWidth().padding(top = spacingSmall), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = userMessage,
                    onValueChange = { userMessage = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Señor juez, objeto...", color = Color.Gray) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceDark,
                        unfocusedContainerColor = SurfaceDark,
                        unfocusedBorderColor = Color.Transparent,
                        focusedBorderColor = PrimaryBlue,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )
                Spacer(modifier = Modifier.width(spacingSmall))
                Button(
                    onClick = { 
                        if(userMessage.isNotBlank()) {
                            viewModel.enviarMensaje(selectedRole, userMessage)
                            userMessage = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    if (uiState.isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                    else Text("Hablar")
                }
            }
        }
        
        if (uiState.error != null) {
            Text("Error: ${uiState.error}", color = WarningAmber, modifier = Modifier.padding(top = spacingSmall))
        }
        }
    }
}
