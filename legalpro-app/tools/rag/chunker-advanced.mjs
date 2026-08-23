#!/usr/bin/env node
/**
 * Advanced Chunker - Estrategias múltiples de chunking para corpus legal peruano
 *
 * Estrategia: Legal-specific chunking (production-ready)
 * - chunkPorArticulo()   → Para códigos legales (CC, CP, CPC, CT, etc.)
 * - chunkPorSeccion()    → Para jurisprudencia, resoluciones y leyes extensas
 * - chunkHibrido()       → Router automático según metadata del documento
 * - chunkPorParrafo()    → Fallback genérico por párrafos
 *
 * Diseño:
 * - Cada chunk incluye id estable (slug + posición) para citaciones verificables
 * - Cada chunk incluye metadata estructurada (tipo, código, número)
 * - Detecta preámbulo (texto antes del primer artículo)
 * - Ignora chunks demasiado cortos (< 50 chars) para evitar ruido
 * - Estadísticas de chunking para auditoría
 *
 * Uso:
 *   import { chunkHibrido } from './tools/rag/chunker-advanced.mjs';
 *   const chunks = chunkHibrido(textoLey, { tipo: 'codigo', codigo: 'CP' });
 *
 * @author  PromptEngineer @ LegalPro / LexIA
 * @version 1.0.0
 * @date    2026-08-01
 */

import { fileURLToPath } from 'node:url';

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CONFIG = {
  minChunkLength: 50,        // chars mínimos para considerar un chunk válido
  maxChunkLength: 8000,      // chars máximos (límite de embeddings OpenAI/Gemini)
  paragraphMinLength: 100,   // chars mínimos para considerar un párrafo
  preambuloMaxChars: 5000,   // si el preámbulo excede, se descarta o se corta
};

// ==========================================
// UTILIDADES
// ==========================================

/**
 * Slug seguro para usar como id de chunk
 */
function slugify(text) {
  return String(text || 'unknown')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')        // quitar diacríticos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'unknown';
}

/**
 * Cuenta palabras reales (no solo whitespace)
 */
function wordCount(text) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Trunca texto al límite duro de embeddings
 */
function safeTruncate(text, max = CONFIG.maxChunkLength) {
  if (!text) return '';
  if (text.length <= max) return text;
  // cortar en el último espacio antes del límite para no romper palabras
  const cut = text.substring(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.8 ? cut.substring(0, lastSpace) : cut) + '...';
}

// ==========================================
// ESTRATEGIA 1: POR ARTÍCULO (códigos legales)
// ==========================================

/**
 * Detecta todos los artículos en un texto legal peruano.
 *
 * Patrones soportados:
 *   - "Artículo 1"
 *   - "Artículo 1.-"
 *   - "Art. 1"
 *   - "Art. 1º"
 *   - "Art 1°"
 *   - "Artículo 123-A", "Artículo 456-B"
 *
 * NOTA: Se recorre con exec() y se guarda cada match, luego se itera
 * por índice para evitar el bug de "exec doble" que produce infinite loop
 * cuando el puntero del regex ya fue avanzado.
 */
export function chunkPorArticulo(texto, nombreCodigo) {
  if (!texto || typeof texto !== 'string') {
    return [];
  }

  const articuloRegex = /(?:Art(?:ículo|\.)\s*\.?\s*)(\d+(?:[-º°]\w+)*)/gi;
  const matches = [];
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = articuloRegex.exec(texto)) !== null) {
    matches.push({ index: m.index, numero: m[1] });
  }

  if (matches.length === 0) {
    return [];
  }

  const chunks = [];
  const codigoSlug = slugify(nombreCodigo);

  // Preámbulo (texto antes del primer artículo)
  const preambulo = texto.substring(0, matches[0].index).trim();
  if (preambulo.length >= CONFIG.minChunkLength) {
    const preambuloContent = safeTruncate(preambulo, CONFIG.preambuloMaxChars);
    chunks.push({
      id: `${codigoSlug}-preambulo`,
      content: preambuloContent,
      metadata: {
        tipo: 'preambulo',
        codigo: nombreCodigo,
        palabras: wordCount(preambuloContent)
      }
    });
  }

  // Cada artículo
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : texto.length;
    const chunkText = texto.substring(startIdx, endIdx).trim();

    if (chunkText.length < CONFIG.minChunkLength) continue;

    const safeContent = safeTruncate(chunkText);

    chunks.push({
      id: `${codigoSlug}-art-${matches[i].numero}`,
      content: safeContent,
      metadata: {
        tipo: 'articulo',
        codigo: nombreCodigo,
        numero: matches[i].numero,
        palabras: wordCount(safeContent)
      }
    });
  }

  return chunks;
}

// ==========================================
// ESTRATEGIA 2: POR SECCIÓN (jurisprudencia / resoluciones)
// ==========================================

/**
 * Divide por secciones usando doble salto de línea como delimitador.
 * Para jurisprudencia y resoluciones donde no hay patrón "Artículo N".
 */
export function chunkPorSeccion(texto, titulo) {
  if (!texto || typeof texto !== 'string') {
    return [];
  }

  // Normalizar saltos de línea
  const normalized = texto.replace(/\r\n/g, '\n');
  // Doble salto (con posible whitespace entre) = nueva sección
  const secciones = normalized.split(/\n\s*\n+/);

  const tituloSlug = slugify(titulo);

  return secciones
    .map((s) => s.trim())
    .filter((s) => s.length >= CONFIG.paragraphMinLength)
    .map((s, i) => {
      const content = safeTruncate(s);
      return {
        id: `${tituloSlug}-sec-${i}`,
        content,
        metadata: {
          tipo: 'seccion',
          titulo,
          posicion: i,
          palabras: wordCount(content)
        }
      };
    });
}

// ==========================================
// ESTRATEGIA 3: POR PÁRRAFO (fallback genérico)
// ==========================================

/**
 * Divide un texto en chunks por párrafos (líneas individuales largas).
 * Útil cuando no se puede detectar estructura (documentos escaneados, oficios, etc.)
 */
export function chunkPorParrafo(texto, titulo = 'documento') {
  if (!texto || typeof texto !== 'string') {
    return [];
  }

  const normalized = texto.replace(/\r\n/g, '\n');
  const lineas = normalized.split(/\n+/);

  const tituloSlug = slugify(titulo);

  return lineas
    .map((l) => l.trim())
    .filter((l) => l.length >= CONFIG.paragraphMinLength)
    .map((l, i) => {
      const content = safeTruncate(l);
      return {
        id: `${tituloSlug}-par-${i}`,
        content,
        metadata: {
          tipo: 'parrafo',
          titulo,
          posicion: i,
          palabras: wordCount(content)
        }
      };
    });
}

// ==========================================
// ROUTER HÍBRIDO
// ==========================================

/**
 * Decide la estrategia de chunking según el metadata del documento.
 *
 * Reglas de decisión:
 *   - tipo === 'codigo' o hay codigo         → chunkPorArticulo
 *   - tipo === 'jurisprudencia' o 'sentencia' → chunkPorSeccion
 *   - tipo === 'resolucion' o 'directiva'     → chunkPorSeccion
 *   - fallback                                → chunkPorParrafo
 *
 * @param {string} texto   - Texto completo del documento
 * @param {object} metadata - { tipo, codigo, id, ... }
 * @returns {Array}        - Lista de chunks con id estable y metadata
 */
export function chunkHibrido(texto, metadata = {}) {
  if (!texto || typeof texto !== 'string') {
    return [];
  }

  const tipo = String(metadata.tipo || '').toLowerCase();
  const codigo = metadata.codigo || metadata.id;

  // Códigos legales: priorizar chunking por artículo
  if (tipo === 'codigo' || tipo === 'codigo_legal' || codigo) {
    const articulos = chunkPorArticulo(texto, codigo || 'codigo');
    if (articulos.length > 0) return articulos;
    // Si no se detectaron artículos, fallback a secciones
  }

  // Jurisprudencia, resoluciones y directivas
  if (
    tipo === 'jurisprudencia' ||
    tipo === 'sentencia' ||
    tipo === 'resolucion' ||
    tipo === 'directiva'
  ) {
    return chunkPorSeccion(texto, metadata.id || metadata.titulo || 'jurisprudencia');
  }

  // Fallback genérico
  return chunkPorParrafo(texto, metadata.id || metadata.titulo || 'documento');
}

// ==========================================
// ESTADÍSTICAS DE CHUNKING (para auditoría)
// ==========================================

/**
 * Genera estadísticas del proceso de chunking.
 * Útil para validar la calidad del corpus indexado.
 */
export function estadisticasChunking(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { total: 0, palabras_total: 0, longitud_promedio: 0, longitud_min: 0, longitud_max: 0 };
  }

  const longitudes = chunks.map((c) => (c.content || '').length);
  const totalPalabras = chunks.reduce((sum, c) => sum + (c.metadata?.palabras || 0), 0);

  return {
    total: chunks.length,
    palabras_total: totalPalabras,
    longitud_promedio: Math.round(longitudes.reduce((a, b) => a + b, 0) / chunks.length),
    longitud_min: Math.min(...longitudes),
    longitud_max: Math.max(...longitudes),
    tipos: chunks.reduce((acc, c) => {
      const t = c.metadata?.tipo || 'desconocido';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  };
}

// ==========================================
// CLI (testing manual)
// ==========================================

// CLI guard cross-platform (Windows usa backslashes, POSIX usa forward slashes).
// import.meta.url siempre viene como URL normalizada.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sample = `TÍTULO PRELIMINAR

La persona humana es el fin supremo de la sociedad y del Estado.

Artículo 1.- La persona humana es el fin supremo de la sociedad y del Estado.
Artículo 2.- Toda persona tiene derecho a la vida, a su identidad, a su integridad moral, psíquica y física.
Artículo 3.- Toda persona tiene derecho a la libertad y a la seguridad.

DISPOSICIONES COMPLEMENTARIAS

Artículo 4.- Deróganse todas las disposiciones que se opongan a la presente.`;

  console.log('🧪 Test chunker-advanced.mjs\n');
  console.log('📥 Texto de entrada:', sample.length, 'caracteres\n');

  const chunks = chunkHibrido(sample, { tipo: 'codigo', codigo: 'CC-PE-1984' });

  console.log(`📊 Chunks generados: ${chunks.length}\n`);
  chunks.forEach((c) => {
    console.log(`  • [${c.id}] (${c.metadata.tipo}) — ${c.content.length} chars / ${c.metadata.palabras} palabras`);
  });

  const stats = estadisticasChunking(chunks);
  console.log('\n📈 Estadísticas:', JSON.stringify(stats, null, 2));
}