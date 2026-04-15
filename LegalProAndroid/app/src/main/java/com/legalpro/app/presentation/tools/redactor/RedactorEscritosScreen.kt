package com.legalpro.app.presentation.tools.redactor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import com.legalpro.app.R
import com.legalpro.app.presentation.components.SpriteIcon
import com.legalpro.app.presentation.components.SpriteA
import com.legalpro.app.presentation.components.SpriteB
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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

@Composable
fun RedactorEscritosScreen() {
    // Responsive Values
    val paddingSmall = ResponsiveValues.getPaddingSmall()
    val paddingMedium = ResponsiveValues.getPaddingMedium()
    val bodyFontSize = ResponsiveValues.getBodyFontSize()
    val spacingSmall = ResponsiveValues.getSpacingSmall()

    val viewModel: RedactorEscritosViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsState()

    var showWizard by remember { mutableStateOf(true) }
    val wizardSteps = listOf(
        WizardStep("Tipo de Escrito", "Indica qué tipo de documento legal necesitas: Demanda, Denuncia, Habeas Corpus, Recurso de Apelación, Nulidad, etc.", R.drawable.sprite_a, SpriteA.EDIT),
        WizardStep("Datos del Caso", "Ingresa el Distrito Judicial y un breve resumen de los hechos. La IA complementará automáticamente con la estructura procesal correcta.", R.drawable.sprite_a, SpriteA.CHECKLIST),
        WizardStep("Borrador Inteligente", "Obtendrás un escrito completo con fundamentos legales, citas de artículos y jurisprudencia. Podrás copiarlo y editarlo antes de presentarlo.", R.drawable.sprite_b, SpriteB.COPY)
    )

    if (showWizard) {
        ToolWizardDialog(
            toolName = "Redactor Legal IA",
            steps = wizardSteps,
            onDismissRequest = { showWizard = false }
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(paddingSmall),
        verticalArrangement = Arrangement.spacedBy(paddingSmall)
    ) {
        item {
            OutlinedTextField(
                value = uiState.tipoEscrito,
                onValueChange = { viewModel.updateTipoEscrito(it) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Tipo de Escrito", color = Color.Gray) },
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                    unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue
                )
            )
        }
        item {
            OutlinedTextField(
                value = uiState.distritoJudicial,
                onValueChange = { viewModel.updateDistritoJudicial(it) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Distrito Judicial", color = Color.Gray) },
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                    unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue
                )
            )
        }
        item {
            val textFieldHeight = ResponsiveValues.getTextFieldShortHeight()
            OutlinedTextField(
                value = uiState.hechosCausa,
                onValueChange = { viewModel.updateHechosCausa(it) },
                modifier = Modifier.fillMaxWidth().height(textFieldHeight),
                label = { Text("Breve Resumen de Hechos (Prompt)", color = Color.Gray) },
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                    unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue
                ),
                maxLines = 5
            )
        }
        
        item {
            val buttonHeight = ResponsiveValues.getButtonHeight()
            Button(
                onClick = { viewModel.generarBorrador() },
                modifier = Modifier.fillMaxWidth().height(buttonHeight),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                enabled = !uiState.isLoading
            ) {
                if (uiState.isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                else Text("Generar Borrador Legal", fontWeight = FontWeight.Bold)
            }
        }

        if (uiState.error != null) {
            item {
                Text(uiState.error!!, color = WarningAmber, fontWeight = FontWeight.Bold)
            }
        }

        if (uiState.borradorGenerado != null) {
            item {
                Box(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(SurfaceDark).padding(paddingMedium)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            SpriteIcon(spriteRes = R.drawable.sprite_a, icon = SpriteA.AI, tint = PrimaryBlue, modifier = Modifier.size(24.dp))
                            Spacer(modifier = Modifier.width(spacingSmall))
                            Text("Borrador Inteligente Gemini", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(paddingSmall))
                        Text(uiState.borradorGenerado!!, color = Color.LightGray, fontSize = bodyFontSize)
                        
                        if (uiState.leyesCitadas.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(paddingSmall))
                            HorizontalDivider(color = BorderDark)
                            Spacer(modifier = Modifier.height(spacingSmall))
                            Text("Bases Legales (RAG):", color = PrimaryBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            uiState.leyesCitadas.forEach { ley ->
                                Text("• $ley", color = Color.Gray, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
