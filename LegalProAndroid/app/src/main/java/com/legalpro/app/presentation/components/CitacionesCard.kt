/**
 * CitacionesCard - Componente Composable para mostrar citaciones RAG
 *
 * Visualiza las fuentes legales consultadas por el RAG con:
 * - Numeración [1], [2], [3]
 * - Porcentaje de similitud
 * - Color según nivel de confianza (verde / amarillo / naranja)
 * - Enlace funcional a la fuente oficial (SPIJ, TC, PJ) vía LocalUriHandler
 * - Disclaimer de revisión humana en español Perú
 *
 * Sin red ni estado: solo consume un [RagResponse] y delega el evento
 * de apertura de URL al [LocalUriHandler] provisto por Compose.
 *
 * @author @android
 * @version 1.0.0
 * @date 2026-08-01
 */

package com.legalpro.app.presentation.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.legalpro.app.data.rag.Citacion
import com.legalpro.app.data.rag.RagResponse

/**
 * Card de citaciones RAG. Si el RAG no fue usado o no hay citaciones,
 * el composable no renderiza nada (retorna sin emitir UI).
 */
@Composable
fun CitacionesCard(
    rag: RagResponse,
    modifier: Modifier = Modifier
) {
    if (!rag.ragUsado || rag.citaciones.isEmpty()) return

    val uriHandler = LocalUriHandler.current

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .semantics {
                contentDescription = "Citaciones de la base legal peruana utilizadas por la IA"
            },
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF0F172A)
        ),
        border = BorderStroke(1.dp, Color(0xFF06B6D4))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Cabecera
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Start
            ) {
                Icon(
                    imageVector = Icons.Default.Article,
                    contentDescription = null,
                    tint = Color(0xFF06B6D4),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "${rag.citaciones.size} fuentes citadas",
                    color = Color(0xFF06B6D4),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                if (rag.ragSimilitudPromedio > 0.0) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "· ${(rag.ragSimilitudPromedio * 100).toInt()}% relevancia",
                        color = Color(0xFF06B6D4).copy(alpha = 0.6f),
                        fontSize = 10.sp
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // Citaciones
            rag.citaciones.forEach { cit ->
                CitacionItem(
                    citacion = cit,
                    onOpenUrl = { url ->
                        runCatching { uriHandler.openUri(url) }
                    }
                )
                Spacer(Modifier.height(4.dp))
            }

            // Disclaimer legal (obligatorio por catálogo de disclaimers IA)
            if (rag.necesitaRevisionHumana) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "⚠️ Verifica cada cita. Esta respuesta es orientativa y no constituye asesoría legal.",
                    color = Color(0xFFFBBF24),
                    fontSize = 10.sp,
                    fontStyle = FontStyle.Italic
                )
            }
        }
    }
}

@Composable
private fun CitacionItem(
    citacion: Citacion,
    onOpenUrl: (String) -> Unit
) {
    val similitudColor = when {
        citacion.similitud >= 0.80 -> Color(0xFF22C55E) // verde
        citacion.similitud >= 0.60 -> Color(0xFFFBBF24) // amarillo
        else -> Color(0xFFFB923C)                       // naranja
    }

    val url = citacion.url
    val canOpenUrl = !url.isNullOrBlank()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = Color.Black.copy(alpha = 0.3f),
                shape = RoundedCornerShape(4.dp)
            )
            .border(
                width = 0.5.dp,
                color = Color(0xFF06B6D4).copy(alpha = 0.2f),
                shape = RoundedCornerShape(4.dp)
            )
            .padding(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = "[${citacion.numero}]",
            color = Color(0xFF06B6D4),
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(end = 8.dp)
        )

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = citacion.fuente,
                    color = Color(0xFFE0F2FE),
                    fontSize = 11.sp,
                    modifier = Modifier.weight(1f)
                )
                if (canOpenUrl) {
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = "Abrir fuente oficial en navegador",
                        tint = Color(0xFF06B6D4),
                        modifier = Modifier
                            .size(14.dp)
                            .clickable(enabled = true) { onOpenUrl(url!!) }
                            .semantics {
                                role = Role.Button
                                contentDescription =
                                    "Abrir fuente oficial: ${citacion.fuente}"
                            }
                    )
                }
            }

            Text(
                text = "${(citacion.similitud * 100).toInt()}% similitud",
                color = similitudColor,
                fontSize = 9.sp,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
    }
}
