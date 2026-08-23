#!/usr/bin/env node
// legalpro-app/tools/legal-catalog-updater.mjs
// Deep Search Legal — Busca y actualiza catálogos con nuevas leyes peruanas
// usando Gemini 2.5 Flash Lite con Google Search Grounding.
// Ejecutar: node tools/legal-catalog-updater.mjs
// Programar: CRON diario 01:00 AM
//
// Dependencias: @google/genai (ya incluida en legalpro-app/package.json)
// Variables de entorno requeridas: GEMINI_API_KEY

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Constantes ────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// El script vive en legalpro-app/tools/, subimos 2 niveles para llegar a raíz del repo
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CATALOGOS_PATH = path.resolve(REPO_ROOT, 'catalogs');
const CATALOGO_LEYES_FILE = path.join(CATALOGOS_PATH, 'codigos-leyes.json');

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const API_KEY = process.env.GEMINI_API_KEY;

// Rango de búsqueda: últimos 7 días
const DIAS_BUSQUEDA = 7;
const FECHA_INICIO = new Date(Date.now() - DIAS_BUSQUEDA * 24 * 60 * 60 * 1000);
const FECHA_FIN = new Date();

// ── Funciones auxiliares ──────────────────────────────────────────────────────

/**
 * Genera un identificador único para una norma a partir de su número.
 * Ej: "Ley N° 32145" → "ley-32145", "D.L. 1249" → "dl-1249"
 */
function generarId(numero) {
  if (!numero) {
    // Fallback: usar timestamp si no hay número
    return `norma-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return numero
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `norma-${Date.now()}`;
}

/**
 * Normaliza el tipo de norma al formato usado en el catálogo.
 * Mapea los valores de Gemini a los valores del catálogo existente.
 */
function normalizarTipo(tipo) {
  const mapa = {
    'ley': 'LEY',
    'ley ordinaria': 'LEY',
    'decreto legislativo': 'LEY',
    'd. leg.': 'LEY',
    'd.l.': 'LEY',
    'decreto supremo': 'DECRETO_SUPREMO',
    'd.s.': 'DECRETO_SUPREMO',
    'resolución': 'RESOLUCION',
    'resolución ministerial': 'RESOLUCION',
    'r.m.': 'RESOLUCION',
    'resolución suprema': 'RESOLUCION',
    'r.s.': 'RESOLUCION',
    'resolución de superintendencia': 'RESOLUCION',
    'directiva': 'DIRECTIVA',
    'constitución': 'CONSTITUCION',
    'código': 'CODIGO',
    'codigo': 'CODIGO',
    'decreto de urgencia': 'DECRETO_URGENCIA',
    'd.u.': 'DECRETO_URGENCIA',
  };
  if (!tipo) return 'LEY';
  const clave = tipo.toLowerCase().trim();
  return mapa[clave] || tipo.toUpperCase().replace(/[\s]+/g, '_');
}

/**
 * Convierte la materia legal a una etiqueta canónica.
 */
function normalizarMateria(materia) {
  if (!materia) return 'general';
  const mapa = {
    'penal': 'penal',
    'civil': 'civil',
    'laboral': 'laboral',
    'tributario': 'tributario',
    'constitucional': 'constitucional',
    'ambiental': 'ambiental',
    'administrativo': 'administrativo',
    'comercial': 'comercial',
    'societario': 'comercial',
    'procesal penal': 'procesal_penal',
    'procesal civil': 'procesal_civil',
    'familia': 'familia',
    'seguridad social': 'seguridad_social',
    'mineria': 'mineria_energia',
    'energia': 'mineria_energia',
    'migratorio': 'migratorio',
    'educacion': 'educacion',
    'salud': 'sanitario',
    'propiedad intelectual': 'propiedad_intelectual',
    'consumidor': 'consumidor',
    'arbitraje': 'arbitraje',
    'concursal': 'concursal',
    'compliance': 'compliance',
    'proteccion de datos': 'proteccion_datos',
    'lpdp': 'proteccion_datos',
    'notarial': 'notarial_registral',
    'registral': 'notarial_registral',
    'presupuesto': 'finanzas_publicas',
    'defensa nacional': 'defensa_nacional',
    'genero': 'genero',
    'derechos humanos': 'derechos_humanos',
  };
  return mapa[materia.toLowerCase().trim()] || materia.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parsea la respuesta JSON de Gemini, manejando posibles variaciones
 * en el formato de salida (JSON puro, markdown con bloques ```json, etc.)
 */
function extraerJsonDeRespuesta(texto) {
  if (!texto) return null;

  // Intentar 1: respuesta directa como JSON
  try {
    const parsed = JSON.parse(texto);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // No era JSON directo, continuar
  }

  // Intentar 2: bloque ```json ... ```
  const bloqueJson = texto.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (bloqueJson) {
    try {
      const parsed = JSON.parse(bloqueJson[1].trim());
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Ignorar, seguir intentando
    }
  }

  // Intentar 3: objeto JSON suelto en el texto (entre { y })
  const objetoJson = texto.match(/\{[\s\S]*\}/);
  if (objetoJson) {
    try {
      const parsed = JSON.parse(objetoJson[0]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // No se pudo extraer
    }
  }

  return null;
}

/**
 * Lee el catálogo actual de leyes.
 */
function leerCatalogo() {
  if (!fs.existsSync(CATALOGO_LEYES_FILE)) {
    console.error(`[ERROR] No se encuentra el catálogo: ${CATALOGO_LEYES_FILE}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(CATALOGO_LEYES_FILE, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Guarda el catálogo actualizado.
 */
function guardarCatalogo(catalogo) {
  fs.writeFileSync(CATALOGO_LEYES_FILE, JSON.stringify(catalogo, null, 2) + '\n', 'utf-8');
}

/**
 * Incrementa la versión semántica (patch).
 * Ej: "1.0.0" → "1.0.1"
 */
function incrementarVersion(versionActual) {
  const partes = versionActual.split('.').map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) {
    return '1.0.1'; // fallback si el formato es inválido
  }
  partes[2] += 1;
  return partes.join('.');
}

/**
 * Formatea una fecha YYYY-MM-DD a partir de un objeto Date o string.
 */
function formatearFecha(date) {
  if (typeof date === 'string') {
    // Ya está en formato ISO o YYYY-MM-DD
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return date;
  }
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Construye el prompt para Gemini con las fechas exactas de búsqueda.
 */
function construirPrompt() {
  const inicio = formatearFecha(FECHA_INICIO);
  const fin = formatearFecha(FECHA_FIN);

  return `Eres un investigador legal especializado en el ordenamiento peruano.

Busca en internet las NORMAS LEGALES PERUANAS publicadas entre el ${inicio} y el ${fin}.

Fuentes oficiales a consultar (obligatorio):
- https://spij.minjus.gob.pe (Sistema Peruano de Información Jurídica)
- https://busquedas.elperuano.pe (Diario Oficial El Peruano — normas legales)
- https://www.congreso.gob.pe (Leyes aprobadas por el Congreso)
- https://www.gob.pe/normas-legales (Portal único del Estado Peruano)

SOLO leyes de PERÚ. NO incluyas leyes de otros países (Chile, Colombia, México, etc.).
NO incluyas proyectos de ley no aprobados. SOLO normas publicadas oficialmente.
NO inventes normas. Si no encuentras ninguna, responde: {"nuevas_leyes":[]}

Para cada norma encontrada, proporciona en formato JSON con esta estructura EXACTA:

{
  "nuevas_leyes": [
    {
      "nombre": "Nombre oficial completo de la norma",
      "numero": "Ley N° 32145" o "D.L. 1567" o "D.S. 005-2026-JUS",
      "fecha_publicacion": "${inicio}",
      "tipo": "Ley|Decreto Legislativo|Decreto Supremo|Resolución|Decreto de Urgencia|Directiva",
      "materia": "penal|civil|laboral|tributario|constitucional|ambiental|administrativo|comercial|procesal_penal|procesal_civil|familia|seguridad_social|...",
      "articulos_clave": "Art. 1, Art. 5, Art. 12",
      "resumen": "Breve resumen de 1-2 líneas sobre qué regula la norma.",
      "url_oficial": "https://busquedas.elperuano.pe/..."
    }
  ]
}

IMPORTANTE:
- Cada elemento debe tener TODOS los campos (nombre, numero, fecha_publicacion, tipo, materia, articulos_clave, resumen, url_oficial).
- Si no hay normas nuevas, responde EXACTAMENTE: {"nuevas_leyes":[]}
- La respuesta DEBE ser JSON válido, sin markdown ni texto adicional.`;
}

// ── Función principal ─────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  LEGAL CATALOG UPDATER — Deep Search Legal');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Modelo:      ${GEMINI_MODEL}`);
  console.log(`  Período:     ${formatearFecha(FECHA_INICIO)} → ${formatearFecha(FECHA_FIN)}`);
  console.log(`  Catálogo:    ${CATALOGO_LEYES_FILE}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Validar API Key ─────────────────────────────────────────────────────
  if (!API_KEY) {
    console.error('[ERROR] Variable GEMINI_API_KEY no configurada.');
    console.error('        Crea un archivo .env en legalpro-app/ con:');
    console.error('        GEMINI_API_KEY=AIzaSy...');
    console.error();
    console.error('        O configúrala en Railway:');
    console.error('        railway variables set GEMINI_API_KEY=AIzaSy...');
    process.exit(1);
  }

  // ── Leer catálogo actual ────────────────────────────────────────────────
  console.log('[1/5] Leyendo catálogo actual...');
  let catalogo;
  try {
    catalogo = leerCatalogo();
  } catch (err) {
    console.error(`[ERROR] No se pudo leer el catálogo: ${err.message}`);
    process.exit(1);
  }

  const versionAnterior = catalogo.version || '0.0.0';
  const normasExistentes = catalogo.normas || [];
  console.log(`      Versión actual: ${versionAnterior}`);
  console.log(`      Normas registradas: ${normasExistentes.length}`);

  // ── Indexar normas existentes para detección de duplicados ──────────────
  const numbersExistentes = new Set(
    normasExistentes
      .map(n => n.numero?.toLowerCase().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
  const nombresExistentes = new Set(
    normasExistentes
      .map(n => n.nombre?.toLowerCase().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );

  // ── Inicializar Gemini ─────────────────────────────────────────────────
  console.log('[2/5] Inicializando Gemini con Google Search Grounding...');
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // ── Ejecutar consulta a Gemini ──────────────────────────────────────────
  const prompt = construirPrompt();
  console.log('[3/5] Ejecutando Deep Search Legal (Gemini + Google Search)...');
  console.log(`      Consultando normas de los últimos ${DIAS_BUSQUEDA} días...`);

  let responseText;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        tools: [{ googleSearch: {} }],
      },
    });

    responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extraer grounding metadata si está disponible
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata) {
      const sources = groundingMetadata.groundingChunks || [];
      if (sources.length > 0) {
        console.log(`      ✓ Gemini usó ${sources.length} fuente(s) web como sustento`);
      }
    }

    if (!responseText) {
      console.warn('[WARN] Gemini devolvió una respuesta vacía.');
      console.log('\n[RESULTADO] No se encontraron normas nuevas.');
      process.exit(0);
    }

    // Log de uso de tokens para tracking de costos
    const usage = response.usageMetadata || {};
    if (usage.promptTokenCount || usage.candidatesTokenCount) {
      console.log(`      Tokens: ${usage.promptTokenCount || 0} prompt + ${usage.candidatesTokenCount || 0} completion`);
    }
  } catch (err) {
    console.error(`[ERROR] Falló la consulta a Gemini: ${err.message}`);
    if (err.status === 429) {
      console.error('        Límite de cuota excedido. Espera y reintenta.');
    }
    if (err.status === 403 || err.status === 401) {
      console.error('        Error de autenticación. Verifica GEMINI_API_KEY.');
    }
    process.exit(1);
  }

  // ── Parsear respuesta JSON ──────────────────────────────────────────────
  console.log('[4/5] Parseando respuesta de Gemini...');
  const datos = extraerJsonDeRespuesta(responseText);

  if (!datos) {
    console.warn('[WARN] No se pudo extraer JSON de la respuesta de Gemini.');
    console.warn('      Respuesta raw (primeros 500 chars):');
    console.warn('      ', responseText.slice(0, 500));
    console.log('\n[RESULTADO] No se pudieron procesar normas nuevas.');
    process.exit(0);
  }

  let nuevasLeyes = datos.nuevas_leyes || datos.nuevasNormas || datos.leyes || datos.normas || [];

  // Si el resultado es un array directamente, úsalo
  if (Array.isArray(datos)) {
    nuevasLeyes = datos;
  }

  if (!Array.isArray(nuevasLeyes) || nuevasLeyes.length === 0) {
    console.log('\n[RESULTADO] No se encontraron normas nuevas en los últimos 7 días.');
    console.log('           El catálogo se mantiene sin cambios.');
    process.exit(0);
  }

  console.log(`      Gemini encontró ${nuevasLeyes.length} posible(s) norma(s).`);

  // ── Filtrar duplicados y mapear al formato del catálogo ─────────────────
  const normasAgregadas = [];

  for (const raw of nuevasLeyes) {
    if (!raw || typeof raw !== 'object') continue;

    const numero = (raw.numero || '').toString().trim();
    const nombre = (raw.nombre || '').toString().trim();

    if (!nombre && !numero) {
      console.warn(`      ⚠ Saltando entrada sin nombre ni número: ${JSON.stringify(raw).slice(0, 100)}`);
      continue;
    }

    // Verificar duplicado por número
    const numeroNormalizado = numero.toLowerCase().replace(/\s+/g, ' ').trim();
    if (numeroNormalizado && numbersExistentes.has(numeroNormalizado)) {
      console.log(`      ⏭ Ya existe: ${numero} — ${nombre || '(sin nombre)'}`);
      continue;
    }

    // Verificar duplicado por nombre
    const nombreNormalizado = nombre.toLowerCase().replace(/\s+/g, ' ').trim();
    if (nombreNormalizado && nombresExistentes.has(nombreNormalizado)) {
      console.log(`      ⏭ Ya existe (por nombre): ${nombre}`);
      continue;
    }

    // Mapear al formato del catálogo
    const id = generarId(numero || nombre);
    const tipo = normalizarTipo(raw.tipo);
    const materia = normalizarMateria(raw.materia);
    const fechaPub = formatearFecha(raw.fecha_publicacion) || formatearFecha(FECHA_FIN);
    const articulosClave = raw.articulos_clave || raw.articulos_mas_citados || '';

    const nuevaNorma = {
      id,
      nombre,
      tipo,
      numero,
      fecha_publicacion: fechaPub,
      fecha_ultima_modificacion: formatearFecha(FECHA_FIN),
      articulos_mas_citados: articulosClave
        .split(',')
        .map(a => a.trim().replace(/^Art[.]?\s*/i, '').replace(/^Artículo\s*/i, ''))
        .filter(Boolean),
      materia,
      resumen: raw.resumen || '',
      url_spij: raw.url_oficial || '',
    };

    normasAgregadas.push(nuevaNorma);
    numbersExistentes.add(numeroNormalizado);

    console.log(`      ✅ Nueva: ${numero} — ${nombre}`);
  }

  // ── Actualizar catálogo ─────────────────────────────────────────────────
  if (normasAgregadas.length === 0) {
    console.log('\n[RESULTADO] No hay normas nuevas para agregar (todas ya existían).');
    process.exit(0);
  }

  console.log('\n[5/5] Actualizando catálogo...');
  const nuevaVersion = incrementarVersion(versionAnterior);

  // Agregar nuevas normas al inicio del array (más recientes primero)
  catalogo.normas = [...normasAgregadas, ...normasExistentes];
  catalogo.version = nuevaVersion;
  catalogo.ultima_actualizacion = formatearFecha(FECHA_FIN);
  catalogo.fecha_ultima_busqueda = new Date().toISOString();

  guardarCatalogo(catalogo);

  // ── Reporte final ───────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  REPORTE DE ACTUALIZACIÓN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Versión:      ${versionAnterior} → ${nuevaVersion}`);
  console.log(`  Nuevas leyes: ${normasAgregadas.length}`);
  console.log(`  Total normas: ${catalogo.normas.length}`);
  console.log(`  Tiempo total: ${elapsed}s`);
  console.log('───────────────────────────────────────────────────────────────');

  for (const norma of normasAgregadas) {
    console.log(`  • ${norma.numero.padEnd(22)} ${norma.nombre}`);
    console.log(`    Tipo: ${norma.tipo.padEnd(20)} Materia: ${norma.materia}`);
    console.log(`    Publicación: ${norma.fecha_publicacion}`);
    if (norma.resumen) {
      console.log(`    Resumen: ${norma.resumen}`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Catálogo actualizado exitosamente.');
  console.log('═══════════════════════════════════════════════════════════════');
}

// ── Ejecutar ──────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(`\n[FATAL] Error inesperado: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
