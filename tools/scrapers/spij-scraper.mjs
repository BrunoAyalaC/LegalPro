#!/usr/bin/env node
/**
 * SPIJ Scraper — Descarga normas actualizadas del SPIJ (spij.minjus.gob.pe)
 *
 * Scraper para el Sistema Peruano de Información Jurídica del MINJUSDH.
 * Como SPIJ es una SPA Angular, usa Playwright (Chromium headless) para
 * renderizar el contenido y extraer el texto normativo de cada código.
 *
 * Los snapshots JSON resultantes se almacenan en `catalogs/spij-snapshots/`
 * y están listos para ser ingeridos por `tools/rag/index-corpus.mjs`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Uso:
 *   node tools/scrapers/spij-scraper.mjs                  # todos los códigos
 *   node tools/scrapers/spij-scraper.mjs --code=H682692   # solo Código Penal
 *   node tools/scrapers/spij-scraper.mjs --incremental    # sólo si cambió
 *   node tools/scrapers/spij-scraper.mjs --dry-run        # sin descargar
 *   node tools/scrapers/spij-scraper.mjs --force          # re-descarga siempre
 *   node tools/scrapers/spij-scraper.mjs --list           # lista códigos
 *   node tools/scrapers/spij-scraper.mjs --help           # ayuda
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Output:
 *   catalogs/spij-snapshots/H682692-2026-08-01.json
 *   catalogs/spij-snapshots/index.json
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Importable programáticamente:
 *   import { scrapeNorma, CODIGOS_PRINCIPALES } from './tools/scrapers/spij-scraper.mjs';
 *
 * @author  BackendNode @ Abogacía
 * @version 1.0.0
 * @date    2026-08-01
 * @license Propiedad del proyecto LegalPro
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ────────────────────────────────────────────────────────────────────
const REPO_ROOT = path.join(__dirname, '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'catalogs', 'spij-snapshots');

// ── Constantes SPIJ ──────────────────────────────────────────────────────────
const SPIJ_BASE = 'https://spij.minjus.gob.pe/spij-ext-web/';
const USER_AGENT = 'LegalPro-RAG-Bot/1.0 (+https://spij.minjus.gob.pe; contact:legalpro-bot@abogacia.pe)';
const MIN_DELAY_MS = 2500;   // pausa mínima entre normas (respeto al servidor)
const MAX_DELAY_MS = 4000;   // pausa máxima (jitter anti-patrón)
const MAX_RETRIES = 3;       // reintentos por norma ante error transitorio
const NAV_TIMEOUT = 45_000;  // ms — SPIJ a veces tarda en resolver la SPA
const RENDER_DELAY = 2_500;  // ms — espera para que Angular hidrate el DOM

// ── Códigos principales (orden: constitucional → penal → civil → otros) ─────
/** @type {Record<string, string>} */
export const CODIGOS_PRINCIPALES = {
  H682678: 'CONSTITUCION_POLITICA',
  H779494: 'REGLAMENTO_CONGRESO',
  H1288461: 'NUEVO_CPP_CONSTITUCIONAL',
  H682684: 'CODIGO_CIVIL',
  H682685: 'TUO_CODIGO_PROCESAL_CIVIL',
  H682692: 'CODIGO_PENAL',
  H682694: 'CODIGO_PROCESAL_PENAL_638',
  H682695: 'NUEVO_CODIGO_PROCESAL_PENAL_957',
  H682688: 'CODIGO_EJECUCION_PENAL',
  H682700: 'CODIGO_PENAL_MILITAR_POLICIAL',
  H682690: 'CODIGO_JUSTICIA_MILITAR_POLICIAL',
  H682689: 'CODIGO_NINOS_ADOLESCENTES',
  H682687: 'CODIGO_RESPONSABILIDAD_PENAL_ADOLESCENTES',
  H682686: 'CODIGO_COMERCIO',
  H682697: 'CODIGO_PROTECCION_CONSUMIDOR',
  H682696: 'TUO_CODIGO_TRIBUTARIO',
  H682693: 'CODIGO_PROCEDIMIENTOS_PENALES'
};

// ── Cargador resiliente de Playwright ────────────────────────────────────────
/**
 * Playwright vive en `legalpro-app/node_modules/playwright` (declarado como
 * devDependency de @playwright/test). Como los scripts en `tools/` quedan
 * fuera del scope del package.json raíz, hacemos import dinámico desde la
 * ruta absoluta detectada en tiempo de ejecución.
 */
async function loadPlaywright() {
  const candidates = [
    path.join(REPO_ROOT, 'legalpro-app', 'node_modules', 'playwright', 'index.mjs'),
    path.join(REPO_ROOT, 'node_modules', 'playwright', 'index.mjs')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return await import(pathToFileURL(candidate).href);
    }
  }

  // Último recurso: dejar que Node resuelva desde el cwd
  try {
    return await import('playwright');
  } catch {
    throw new Error(
      'No se encontró playwright instalado.\n' +
      'Instálalo con:  npm install --prefix legalpro-app -D @playwright/test\n' +
      'O en la raíz:  npm install -D playwright'
    );
  }
}

// ── Utilidades ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => Math.floor(min + Math.random() * (max - min));

function log(stage, msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] [${stage}] ${msg}`);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Parsea argumentos CLI. Soporta:
 *   --code=H682692
 *   --incremental
 *   --force
 *   --dry-run
 *   --save-html
 *   --list
 *   --help
 */
function parseArgs(argv) {
  const args = {
    code: null,
    incremental: false,
    force: false,
    dryRun: false,
    saveHtml: false,
    list: false,
    help: false
  };

  for (const token of argv) {
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--incremental') args.incremental = true;
    else if (token === '--force') args.force = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--save-html') args.saveHtml = true;
    else if (token === '--list') args.list = true;
    else if (token.startsWith('--code=')) args.code = token.split('=')[1].trim();
    else if (/^H\d{4,8}$/i.test(token)) args.code = token; // ID suelto: H682692
    else console.warn(`⚠️  Argumento ignorado: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log(`
SPIJ Scraper — LegalPro

Uso:
  node tools/scrapers/spij-scraper.mjs [opciones]

Opciones:
  --code=H######   Scrapea SOLO la norma indicada (ej: --code=H682692)
  --incremental    Solo descarga si el contenido cambió desde el último snapshot
  --force          Re-descarga siempre, ignorando snapshots previos
  --dry-run        Navega las páginas pero no guarda nada
  --save-html      Guarda el HTML renderizado junto al JSON (debug)
  --list           Lista los códigos configurados y sale
  --help, -h       Muestra esta ayuda

Snapshots:
  catalogs/spij-snapshots/H######-YYYY-MM-DD.json
  catalogs/spij-snapshots/index.json
`);
}

// ── Extracción en el navegador ───────────────────────────────────────────────
/**
 * Esta función se ejecuta DENTRO del navegador (page.evaluate). Devuelve un
 * payload crudo; la heurística de limpieza posterior ocurre en Node.
 */
function extractPayloadInBrowser() {
  // Quitar elementos que contaminan el texto
  document.querySelectorAll('script, style, noscript, iframe, nav, header, footer')
    .forEach((el) => el.remove());

  const text = (document.body?.innerText || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // ── Metadatos ────────────────────────────────────────────────────────────
  const fechaMatch = text.match(/Fecha de Publicaci[oó]n[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
  const tituloMatch = text.match(/^(CONSTITUCI[OÓ]N[\s\S]{0,200}?)(?:\n|$)/i);

  // ── Tipo y número de norma ──────────────────────────────────────────────
  const tipoNumeroPatterns = [
    /DECRETO\s+LEGISLATIVO\s+N[°ºo]?\s*([0-9]+)/i,
    /LEY\s+N[°ºo]?\s*([0-9]+)/i,
    /DECRETO\s+SUPREMO\s+N[°ºo]?\s*([0-9]+(?:-[A-Z0-9-]+)?)/i,
    /DECRETO\s+DE\s+URGENCI[A-Z]?\s+N[°ºo]?\s*([0-9]+(?:-[0-9]+)?)/i,
    /RESOLUCI[OÓ]N\s+(?:LEGISLATIVA\s+)?N[°ºo]?\s*([0-9]+)/i
  ];

  let tipo = null;
  let numero = null;
  for (const rx of tipoNumeroPatterns) {
    const m = text.match(rx);
    if (m) {
      tipo = m[0].split(/\s+/).slice(0, 3).join(' ');
      numero = m[1];
      break;
    }
  }

  // ── Estado (vigente, derogado, etc.) ───────────────────────────────────
  const estadoMatch = text.match(/Estado[:\s]+(VIGENTE|DEROGADO|MODIFICADO|ABROGADO|REFUNDIDO)/i);

  // ── Detección de inicio del articulado ─────────────────────────────────
  const articuladoStart = lines.findIndex((l) =>
    /^DECRETO\s+(LEGISLATIVO|SUPREMO|DE\s+URGENCI)|^\s*LEY\s+N|^CONSTITUCI[OÓ]N\b|^T[ÍI]TULO\s+PRELIMINAR/i
      .test(l)
  );

  const contenidoArticulos = articuladoStart >= 0
    ? lines.slice(articuladoStart).join('\n')
    : text;

  // ── Conteo aproximado de artículos ─────────────────────────────────────
  const articuloMatches = contenidoArticulos.match(/Art[íi]culo\s+\d+[°ºo]?/gi) || [];
  const articulosUnicos = [...new Set(articuloMatches.map((a) => a.toLowerCase()))].length;

  return {
    metadata: {
      titulo: tituloMatch ? tituloMatch[1].trim() : null,
      tipo,
      numero,
      fecha_publicacion: fechaMatch ? fechaMatch[1].trim() : null,
      estado: estadoMatch ? estadoMatch[1].toUpperCase() : null,
      total_articulos_detectados: articulosUnicos
    },
    contenido_completo: text,
    contenido_articulos: contenidoArticulos,
    fecha_extraccion: new Date().toISOString(),
    url_fuente: window.location.href
  };
}

// ── Scraping de una norma ────────────────────────────────────────────────────
/**
 * @param {import('playwright').Page} page
 * @param {string} idNorma         ej: "H682692"
 * @param {string} nombreCorto     ej: "CODIGO_PENAL"
 * @param {{ dryRun?: boolean, saveHtml?: boolean }} [opts]
 */
async function scrapeNorma(page, idNorma, nombreCorto, opts = {}) {
  const url = `${SPIJ_BASE}#/detallenorma/${idNorma}`;
  log('NAV', `${nombreCorto} (${idNorma}) → ${url}`);

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
      // Espera activa: que el contenedor de contenido tenga texto
      await page.waitForFunction(
        () => (document.body?.innerText || '').length > 500,
        { timeout: NAV_TIMEOUT }
      );
      await page.waitForTimeout(RENDER_DELAY);
      break;
    } catch (err) {
      lastError = err;
      log('WARN', `Intento ${attempt}/${MAX_RETRIES} falló: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(jitter(2000, 4000));
    }
  }

  if (lastError && MAX_RETRIES > 0) {
    // Si agotó reintentos, re-lanzar
    const stillFailing = await page.evaluate(() => (document.body?.innerText || '').length);
    if (stillFailing < 500) throw lastError;
  }

  const data = await page.evaluate(extractPayloadInBrowser);

  // Checksum para idempotencia / detección de cambios
  const checksum = sha256(data.contenido_completo);

  const html = opts.saveHtml
    ? await page.content()
    : null;

  const payload = {
    id: idNorma,
    nombre_corto: nombreCorto,
    ...data,
    checksum_sha256: checksum,
    extractor: 'spij-scraper/1.0.0',
    html_renderizado: html
  };

  log('OK', `${data.contenido_completo.length} caracteres extraídos · sha256=${checksum.slice(0, 12)}…`);
  if (data.metadata.fecha_publicacion) {
    log('META', `Fecha publicación: ${data.metadata.fecha_publicacion}`);
  }
  if (data.metadata.total_articulos_detectados > 0) {
    log('META', `Artículos detectados: ${data.metadata.total_articulos_detectados}`);
  }

  return payload;
}

// ── Snapshots: lectura y comparación ─────────────────────────────────────────
function listExistingSnapshots(idNorma) {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  const pattern = new RegExp(`^${idNorma}-(\\d{4}-\\d{2}-\\d{2})\\.json$`);
  return fs.readdirSync(OUTPUT_DIR)
    .filter((f) => pattern.test(f))
    .map((f) => ({
      file: f,
      date: f.match(pattern)[1],
      path: path.join(OUTPUT_DIR, f)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function loadLatestSnapshot(idNorma) {
  const snaps = listExistingSnapshots(idNorma);
  if (snaps.length === 0) return null;
  try {
    const raw = fs.readFileSync(snaps[snaps.length - 1].path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Orquestador principal ────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) { printHelp(); return; }
  if (args.list) {
    console.log('\nCódigos configurados:');
    for (const [id, name] of Object.entries(CODIGOS_PRINCIPALES)) {
      console.log(`  ${id.padEnd(10)} ${name}`);
    }
    console.log(`\nTotal: ${Object.keys(CODIGOS_PRINCIPALES).length} normas`);
    return;
  }

  console.log('🚀 SPIJ Scraper — LegalPro');
  console.log(`Fecha: ${new Date().toISOString()}`);
  if (args.dryRun) console.log('⚠️  MODO DRY-RUN: no se escribirán archivos');
  if (args.incremental) console.log('♻️  MODO INCREMENTAL: solo se descargan normas modificadas');
  if (args.force) console.log('💪 MODO FORCE: se re-descargan todas las normas');
  console.log('');

  // ── Crear directorio de salida ─────────────────────────────────────────
  if (!args.dryRun) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log('FS', `OUTPUT_DIR=${OUTPUT_DIR}`);
  }

  // ── Selección de códigos ───────────────────────────────────────────────
  const codigos = args.code
    ? { [args.code]: CODIGOS_PRINCIPALES[args.code] || 'CUSTOM' }
    : CODIGOS_PRINCIPALES;

  if (args.code && !CODIGOS_PRINCIPALES[args.code]) {
    log('NOTE', `Código ${args.code} no está en el catálogo conocido; se procesa como CUSTOM`);
  }

  // ── Cargar Playwright ─────────────────────────────────────────────────
  log('INIT', 'Cargando Playwright...');
  const { chromium } = await loadPlaywright();

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'es-PE',
    timezoneId: 'America/Lima'
  });

  // Bloquear recursos pesados / trackers para acelerar y reducir ruido
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) return route.abort();
    if (/google-analytics|googletagmanager|facebook|doubleclick/i.test(route.request().url())) {
      return route.abort();
    }
    return route.continue();
  });

  const page = await context.newPage();
  const startTime = Date.now();
  const results = [];

  try {
    for (const [id, nombre] of Object.entries(codigos)) {
      try {
        const previous = args.incremental ? loadLatestSnapshot(id) : null;
        const data = await scrapeNorma(page, id, nombre, {
          dryRun: args.dryRun,
          saveHtml: args.saveHtml
        });

        // ── Decisión incremental ──────────────────────────────────────
        if (args.incremental && previous && previous.checksum_sha256 === data.checksum_sha256) {
          log('SKIP', `${nombre} sin cambios desde ${previous.fecha_extraccion?.slice(0, 10)}`);
          results.push({
            id,
            nombre_corto: nombre,
            accion: 'skipped',
            checksum_anterior: previous.checksum_sha256,
            fecha_snapshot: previous.fecha_extraccion
          });
          continue;
        }

        if (!args.dryRun) {
          const filename = `${id}-${new Date().toISOString().split('T')[0]}.json`;
          const filepath = path.join(OUTPUT_DIR, filename);
          fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
          log('SAVE', `${filename} (${data.contenido_completo.length} chars)`);
        }

        results.push({
          id,
          nombre_corto: nombre,
          accion: args.dryRun ? 'dry-run' : 'saved',
          fecha_publicacion: data.metadata.fecha_publicacion,
          caracteres: data.contenido_completo.length,
          checksum: data.checksum_sha256,
          archivo: args.dryRun
            ? null
            : `${id}-${new Date().toISOString().split('T')[0]}.json`
        });
      } catch (err) {
        log('ERR', `${nombre} (${id}): ${err.message}`);
        results.push({
          id,
          nombre_corto: nombre,
          accion: 'error',
          error: err.message
        });
      }

      // ── Rate limiting respetuoso ───────────────────────────────────
      if (Object.keys(codigos).length > 1) {
        await sleep(jitter(MIN_DELAY_MS, MAX_DELAY_MS));
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  // ── Índice consolidado ─────────────────────────────────────────────────
  if (!args.dryRun) {
    const indexPath = path.join(OUTPUT_DIR, 'index.json');
    const index = {
      fecha_extraccion: new Date().toISOString(),
      modo: args.incremental ? 'incremental' : (args.force ? 'force' : 'completo'),
      total_normas: results.filter((r) => r.accion !== 'error').length,
      total_errores: results.filter((r) => r.accion === 'error').length,
      total_omitidas: results.filter((r) => r.accion === 'skipped').length,
      normas: results
    };
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    log('SAVE', `index.json`);
  }

  // ── Resumen final ──────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const saved = results.filter((r) => r.accion === 'saved').length;
  const skipped = results.filter((r) => r.accion === 'skipped').length;
  const errors = results.filter((r) => r.accion === 'error').length;
  const dryRun = results.filter((r) => r.accion === 'dry-run').length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`   Normas procesadas: ${results.length}`);
  if (saved)     console.log(`   ✅ Guardadas:       ${saved}`);
  if (skipped)   console.log(`   ♻️  Omitidas:        ${skipped}`);
  if (dryRun)    console.log(`   🔍 Dry-run:         ${dryRun}`);
  if (errors)    console.log(`   ❌ Errores:         ${errors}`);
  console.log(`   ⏱️  Tiempo total:    ${elapsed}s`);
  if (!args.dryRun) console.log(`   📁 Snapshots:       ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Exit code: 0 ok, 1 errores, 2 sólo dry-run/warnings
  if (errors > 0) process.exit(1);
  if (saved === 0 && skipped === 0 && dryRun === 0) process.exit(2);
  process.exit(0);
}

// ── Entry-point ──────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error('💥 Error fatal:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
