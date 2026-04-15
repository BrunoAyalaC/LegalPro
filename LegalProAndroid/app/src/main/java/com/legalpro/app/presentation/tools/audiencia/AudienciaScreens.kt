package com.legalpro.app.presentation.tools.audiencia

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import com.legalpro.app.R
import com.legalpro.app.presentation.components.SpriteIcon
import com.legalpro.app.presentation.components.SpriteA
import com.legalpro.app.presentation.components.SpriteB
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.legalpro.app.presentation.theme.*
import com.legalpro.app.presentation.components.ToolWizardDialog
import com.legalpro.app.presentation.components.WizardStep
import kotlinx.coroutines.delay

data class MarcadorAudiencia(val tiempo: String, val nota: String, val tipo: String)

// ═══════════════════════════════════════════════════════
// CRONÓMETRO DE AUDIENCIA + NOTAS
// ═══════════════════════════════════════════════════════
@Composable
fun CronometroAudienciaScreen() {
    var showWizard by remember { mutableStateOf(true) }
    val wizardSteps = listOf(
        WizardStep("Cronómetro Legal", "Inicia el cronómetro al empezar la audiencia. Lleva un control exacto del tiempo para tus alegatos y del tiempo de la contraparte.", R.drawable.sprite_b, SpriteB.TIMER),
        WizardStep("Marcadores", "Presiona 'Marcar' en momentos clave: declaraciones, objeciones, admisión de pruebas. Se guardarán con timestamp.", R.drawable.sprite_b, SpriteB.BOOKMARK),
        WizardStep("Exportar", "Al finalizar, tendrás un registro temporal completo de toda la audiencia que podrás usar como referencia.", R.drawable.sprite_b, SpriteB.DOWNLOAD)
    )
    if (showWizard) {
        ToolWizardDialog(toolName = "Cronómetro de Audiencia", steps = wizardSteps, onDismissRequest = { showWizard = false })
    }

    var isRunning by remember { mutableStateOf(false) }
    var elapsedSeconds by remember { mutableLongStateOf(0L) }
    var marcadores by remember { mutableStateOf(listOf<MarcadorAudiencia>()) }
    var notaRapida by remember { mutableStateOf("") }

    LaunchedEffect(isRunning) {
        while (isRunning) {
            delay(1000)
            elapsedSeconds++
        }
    }

    val hours = elapsedSeconds / 3600
    val minutes = (elapsedSeconds % 3600) / 60
    val seconds = elapsedSeconds % 60
    val timeString = String.format("%02d:%02d:%02d", hours, minutes, seconds)

    Column(modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(16.dp)) {
        Text("Cronómetro de Audiencia", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("Control temporal en vivo", color = Color.Gray, fontSize = 12.sp)

        Spacer(modifier = Modifier.height(32.dp))

        // Timer display
        Box(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(SurfaceDark).padding(32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(timeString, color = if (isRunning) SuccessEmerald else Color.White, fontSize = 48.sp, fontWeight = FontWeight.Bold, letterSpacing = 4.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text(if (isRunning) "EN CURSO" else "DETENIDO", color = if (isRunning) SuccessEmerald else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Controls
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            FloatingActionButton(
                onClick = { isRunning = !isRunning },
                containerColor = if (isRunning) ErrorRed else SuccessEmerald,
                shape = CircleShape, modifier = Modifier.size(64.dp)
            ) {
                SpriteIcon(spriteRes = R.drawable.sprite_b, icon = if (isRunning) SpriteB.PAUSE else SpriteB.PLAY, tint = Color.White, modifier = Modifier.size(32.dp))
            }
            FloatingActionButton(
                onClick = { isRunning = false; elapsedSeconds = 0; marcadores = emptyList() },
                containerColor = SurfaceDark, shape = CircleShape, modifier = Modifier.size(64.dp)
            ) {
                SpriteIcon(spriteRes = R.drawable.sprite_b, icon = SpriteB.RESET, tint = Color.White, modifier = Modifier.size(28.dp))
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Quick note + Marker
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = notaRapida,
                onValueChange = { notaRapida = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Nota: ej. Declaración del testigo", color = Color.Gray, fontSize = 13.sp) },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = SurfaceDark, focusedContainerColor = SurfaceDark,
                    unfocusedBorderColor = BorderDark, focusedBorderColor = PrimaryBlue,
                    unfocusedTextColor = Color.White, focusedTextColor = Color.White
                ),
                shape = RoundedCornerShape(12.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            FloatingActionButton(
                onClick = {
                    marcadores = marcadores + MarcadorAudiencia(timeString, notaRapida.ifBlank { "Marca" }, "nota")
                    notaRapida = ""
                },
                containerColor = PrimaryBlue, shape = RoundedCornerShape(12.dp), modifier = Modifier.height(56.dp)
            ) {
                SpriteIcon(spriteRes = R.drawable.sprite_b, icon = SpriteB.BOOKMARK_ADD, tint = Color.White, modifier = Modifier.size(24.dp))
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        Text("MARCADORES (${marcadores.size})", color = Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(modifier = Modifier.height(8.dp))

        // Markers list
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(marcadores.reversed()) { m ->
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(SurfaceDark).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(PrimaryBlue.copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
                        SpriteIcon(spriteRes = R.drawable.sprite_b, icon = SpriteB.BOOKMARK, tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(m.nota, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        Text(m.tiempo, color = PrimaryBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(ResponsiveValues.getSpacingLarge()))
    }
}

// ═══════════════════════════════════════════════════════
// ASISTENTE DE OBJECIONES EN VIVO (COMPLETO)
// ═══════════════════════════════════════════════════════
data class Objecion(val tipo: String, val fundamento: String, val articulo: String, val ejemploUso: String)

val objecionesNCPP = listOf(
    Objecion("Impertinente", "La pregunta no guarda relación con los hechos materia de juzgamiento ni con la credibilidad del testigo.", "Art. 378.4 NCPP", "\"Señor juez, objeto por impertinente. La pregunta sobre la vida sentimental del testigo no tiene relación con los hechos imputados.\""),
    Objecion("Capciosa", "La pregunta busca confundir al declarante o inducirlo a error mediante un engaño verbal.", "Art. 378.4 NCPP", "\"Objeto por capciosa. La pregunta contiene una premisa falsa que busca confundir al testigo.\""),
    Objecion("Sugestiva", "La pregunta contiene o sugiere la respuesta. Solo permitida en contrainterrogatorio.", "Art. 378.6 NCPP", "\"Objeto por sugestiva. En examen directo, no se pueden hacer preguntas que sugieran la respuesta al testigo.\""),
    Objecion("Compuesta", "La pregunta contiene dos o más preguntas en una sola, impidiendo una respuesta clara.", "Art. 378 NCPP (doctrina)", "\"Objeto por compuesta. La pregunta contiene dos interrogantes distintas. Solicito que se reformule.\""),
    Objecion("Especulativa", "La pregunta pide al testigo que especule, imagine o formule hipótesis sobre hechos que no presenció.", "Art. 378 NCPP (doctrina)", "\"Objeto por especulativa. Se le pide al testigo que imagine algo que no vio ni escuchó directamente.\""),
    Objecion("Repetitiva", "La pregunta ya fue formulada y respondida. Reiterar busca cansar o confundir al declarante.", "Art. 378 NCPP", "\"Objeto. La pregunta ya fue formulada y debidamente respondida. Se está hostigando al testigo.\""),
    Objecion("Argumentativa", "La pregunta no busca información sino que el abogado está argumentando o dando su opinión.", "Art. 378 NCPP (doctrina)", "\"Objeto por argumentativa. El abogado está expresando su opinión, no formulando una pregunta al testigo.\""),
    Objecion("Referencia a prueba no actuada", "Se hace referencia a una prueba documental o pericial que aún no ha sido actuada en juicio.", "Art. 383 NCPP", "\"Objeto. Se está haciendo referencia a un documento que no ha sido incorporado ni oralizado en este juicio.\""),
)

@Composable
fun AsistenteObjecionesLiveScreen() {
    var showWizard by remember { mutableStateOf(true) }
    val wizardSteps = listOf(
        WizardStep("Objeciones Rápidas", "Cuando la contraparte haga una pregunta indebida, toca el tipo de objección. Verás el fundamento legal al instante.", R.drawable.sprite_b, SpriteB.SHIELD),
        WizardStep("Frase Lista", "Cada objección incluye una frase modelo que puedes decir textualmente al juez, adaptándola a tu caso.", R.drawable.sprite_b, SpriteB.RECORD),
        WizardStep("Base Legal NCPP", "Todo está fundamentado en el Nuevo Código Procesal Penal y doctrina procesal peruana.", R.drawable.sprite_b, SpriteB.MENU_BOOK)
    )
    if (showWizard) {
        ToolWizardDialog(toolName = "Objeciones en Vivo", steps = wizardSteps, onDismissRequest = { showWizard = false })
    }

    var selectedObjecion by remember { mutableStateOf<Objecion?>(null) }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(ErrorRed))
            Spacer(modifier = Modifier.width(8.dp))
            Text("OBJECIONES EN VIVO", color = ErrorRed, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        Text("Toca una objeción para ver el fundamento", color = Color.Gray, fontSize = 12.sp)
        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(objecionesNCPP) { obj ->
                val isSelected = selectedObjecion == obj
                Column(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                        .background(if (isSelected) ErrorRed.copy(alpha = 0.15f) else SurfaceDark)
                        .clickable { selectedObjecion = if (isSelected) null else obj }
                        .padding(16.dp)
                        .animateContentSize(animationSpec = spring(stiffness = Spring.StiffnessLow))
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(ErrorRed.copy(alpha = 0.2f)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                            Text(obj.tipo.uppercase(), color = ErrorRed, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(obj.articulo, color = PrimaryBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }

                    if (isSelected) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("FUNDAMENTO:", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                        Text(obj.fundamento, color = Color.LightGray, fontSize = 13.sp, lineHeight = 20.sp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(PrimaryBlue.copy(alpha = 0.1f)).padding(12.dp)) {
                            Column {
                                Text("DIGA EN AUDIENCIA:", color = PrimaryBlue, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(obj.ejemploUso, color = Color.White, fontSize = 13.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(ResponsiveValues.getSpacingLarge()))
    }
}

// ═══════════════════════════════════════════════════════
// CHECKLIST DE REQUISITOS PROCESALES
// ═══════════════════════════════════════════════════════
data class RequisitoProcesal(val nombre: String, val descripcion: String, val baseLegal: String)

val checklistPrisionPreventiva = listOf(
    RequisitoProcesal("Fundados y graves elementos de convicción", "Existen pruebas que vinculan al imputado con el delito", "Art. 268.a NCPP"),
    RequisitoProcesal("Prognosis de pena superior a 4 años", "La pena probable supera los 4 años de privación de libertad", "Art. 268.b NCPP"),
    RequisitoProcesal("Peligro procesal", "Existe peligro de fuga o de obstaculización de la investigación", "Art. 268.c NCPP"),
    RequisitoProcesal("Peligro de fuga: arraigo", "Evaluar arraigo domiciliario, familiar, laboral y bienes", "Art. 269.1 NCPP"),
    RequisitoProcesal("Peligro de fuga: gravedad de pena", "Pena esperada grave incrementa riesgo de fuga", "Art. 269.2 NCPP"),
    RequisitoProcesal("Proporcionalidad", "La medida es proporcional al peligro que se busca evitar", "Art. 253.2 NCPP"),
    RequisitoProcesal("Plazo razonable de investigación", "Verificar que la investigación tiene un plazo definido", "Art. 272 NCPP"),
)

val checklistControlAcusacion = listOf(
    RequisitoProcesal("Datos del imputado", "Identificación completa del acusado", "Art. 349.1.a NCPP"),
    RequisitoProcesal("Relación clara de hechos", "Hechos atribuidos con circunstancias de tiempo, modo y lugar", "Art. 349.1.b NCPP"),
    RequisitoProcesal("Tipificación", "Elementos de convicción que sustentan el requerimiento", "Art. 349.1.c NCPP"),
    RequisitoProcesal("Participación del imputado", "Grado de participación atribuido", "Art. 349.1.d NCPP"),
    RequisitoProcesal("Medios de prueba ofrecidos", "Lista de testigos, peritos y documentos", "Art. 349.1.h NCPP"),
    RequisitoProcesal("Reparación civil", "Cuantía propuesta de reparación civil", "Art. 349.1.g NCPP"),
)

@Composable
fun ChecklistProcesalScreen() {
    var showWizard by remember { mutableStateOf(true) }
    val wizardSteps = listOf(
        WizardStep("Checklists por Audiencia", "Selecciona el tipo de audiencia y verifica en tiempo real si se cumplen los requisitos procesales.", R.drawable.sprite_b, SpriteB.CHECKLIST),
        WizardStep("Marca en Vivo", "Durante la audiencia, ve marcando si el Fiscal o la parte cumplió o no cada requisito. Útil para preparar la objección.", R.drawable.sprite_b, SpriteB.FOLDER_RULE),
        WizardStep("Base Legal", "Cada requisito está fundamentado en el NCPP. Si no se cumple, tienes el artículo exacto para objetar.", R.drawable.sprite_b, SpriteB.POLICY)
    )
    if (showWizard) {
        ToolWizardDialog(toolName = "Checklist Procesal", steps = wizardSteps, onDismissRequest = { showWizard = false })
    }

    var selectedTipo by remember { mutableStateOf("Prisión Preventiva") }
    val tipos = listOf("Prisión Preventiva", "Control de Acusación")
    val currentChecklist = if (selectedTipo == "Prisión Preventiva") checklistPrisionPreventiva else checklistControlAcusacion
    var checkedItems by remember { mutableStateOf(setOf<String>()) }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundDark).padding(16.dp)) {
        Text("Checklist Procesal", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("Verificación de requisitos en audiencia", color = Color.Gray, fontSize = 12.sp)
        Spacer(modifier = Modifier.height(16.dp))

        // Tabs
        Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(SurfaceDark).padding(4.dp)) {
            tipos.forEach { tipo ->
                Box(
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(8.dp))
                        .background(if (selectedTipo == tipo) PrimaryBlue else Color.Transparent)
                        .clickable { selectedTipo = tipo; checkedItems = emptySet() }
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(tipo, color = if (selectedTipo == tipo) Color.White else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Progress
        val progress = if (currentChecklist.isNotEmpty()) checkedItems.size.toFloat() / currentChecklist.size else 0f
        LinearProgressIndicator(
            progress = { progress }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
            color = if (progress >= 1f) SuccessEmerald else PrimaryBlue, trackColor = SurfaceDark
        )
        Text("${checkedItems.size}/${currentChecklist.size} requisitos verificados", color = Color.Gray, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(currentChecklist) { req ->
                val isChecked = checkedItems.contains(req.nombre)
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                        .background(if (isChecked) SuccessEmerald.copy(alpha = 0.1f) else SurfaceDark)
                        .clickable { checkedItems = if (isChecked) checkedItems - req.nombre else checkedItems + req.nombre }
                        .padding(16.dp)
                        .animateContentSize(),
                    verticalAlignment = Alignment.Top
                ) {
                    Checkbox(
                        checked = isChecked, onCheckedChange = { checkedItems = if (isChecked) checkedItems - req.nombre else checkedItems + req.nombre },
                        colors = CheckboxDefaults.colors(checkedColor = SuccessEmerald, uncheckedColor = BorderDark)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(req.nombre, color = if (isChecked) SuccessEmerald else Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text(req.descripcion, color = Color.Gray, fontSize = 12.sp)
                        Text(req.baseLegal, color = PrimaryBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(ResponsiveValues.getSpacingLarge()))
    }
}
