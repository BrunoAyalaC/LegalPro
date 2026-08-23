#!/usr/bin/env node
/**
 * LP Derecho Playwright Scraper - Vía real que pasa Cloudflare
 *
 * Complemento de lpderecho-scraper.mjs. El sitio lpderecho.pe está protegido
 * por Cloudflare (challenge JS) que bloquea fetch/curl directos. Este script
 * usa un navegador real (Playwright) que sí pasa el challenge.
 *
 * Requisitos:
 *   npm i -D playwright          # o usar la versión transitiva ya presente
 *   npx playwright install chromium
 *
 * Uso:
 *   node tools/scrapers/lpderecho-playwright.mjs                       # Índice: sitemap1 (1000 URLs)
 *   node tools/scrapers/lpderecho-playwright.mjs --limit=5000          # Más URLs
 *   node tools/scrapers/lpderecho-playwright.mjs --all                 # Todo el sitio (~67k)
 *   node tools/scrapers/lpderecho-playwright.mjs --fetch-content=50    # Descarga contenido de 50 artículos
 *
 * Throttling: 1.2s entre sitemaps, 0.8-1.5s entre artículos (respetuoso).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'catalogs', 'lpderecho-snapshots');

const SITE = 'https://lpderecho.pe';
const SITEMAP_INDEX = `${SITE}/sitemap_index.xml`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Extrae URLs de un XML de sitemap (renderizado por Yoast como tabla HTML) */
function parseSitemapUrls(xml) {
  // Yoast renderiza el sitemap como tabla: las URLs quedan pegadas a la fecha
  // (ej: https://lpderecho.pe/slug/02016-02-08). Recortamos en la fecha.
  const raw = xml.match(/https:\/\/lpderecho\.pe\/[^\s<]+/g) || [];
  return raw.map((u) => u.replace(/\/0\d{4}-\d{2}-\d{2}$/, '').trim()).filter(Boolean);
}

/** Extrae las URLs de sitemaps del sitemap_index (páginas .xml) */
function parseSitemapIndex(xml) {
  const raw = xml.match(/https:\/\/lpderecho\.pe\/[^\s<]+/g) || [];
  return raw.map((u) => u.replace(/\d{4}-\d{2}-\d{2}\s*$/, '').trim()).filter(Boolean);
}

/** Extrae el contenido del artículo (tema Newspaper/tagDiv) */
function extractArticle(html, url) {
  const getFirst = (re) => {
    const m = re.exec(html);
    return m ? m[1].trim() : null;
  };
  const title =
    getFirst(/<h1[^>]*class="[^"]*tdb-title-text[^"]*"[^>]*>([\s\S]*?)<\/h1>/) ||
    getFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/);

  const bodyMatch = /<div[^>]*class="[^"]*td-post-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(html);
  let body = bodyMatch ? bodyMatch[1] : null;
  if (!body) {
    const idx = html.indexOf('td-post-content');
    if (idx !== -1) body = html.slice(idx, idx + 30000);
  }
  if (body) {
    body = body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#8211;/g, '–')
      .replace(/&#8212;/g, '—')
      .replace(/&#8220;|&#8221;/g, '"')
      .replace(/&#8217;|&#8216;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  const date =
    getFirst(/<time[^>]*datetime="([^"]+)"/) ||
    getFirst(/class="[^"]*tdb-date[^"]*"[^>]*>\s*([^<]{5,60})/) ||
    getFirst(/<time[^>]*>([^<]{5,60})<\/time>/);

  const catsMatch = /<div[^>]*class="[^"]*tdb-category[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const categories = catsMatch
    ? Array.from(catsMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)).map((m) => m[1].trim())
    : [];

  return {
    url,
    titulo: title?.replace(/\s+/g, ' '),
    fecha: date,
    categorias: categories.slice(0, 10),
    contenido: body?.substring(0, 20000),
    longitud: body?.length || 0,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);
  const fetchCount = parseInt(args.find((a) => a.startsWith('--fetch-content='))?.split('=')[1] || '0', 10);
  const all = args.includes('--all');
  const effectiveLimit = all ? Infinity : limit;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('🚀 LP Derecho Playwright Scraper - LegalPro');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Límite URLs: ${all ? 'TODAS' : limit} | contenido: ${fetchCount}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  // Estado Cloudflare: .lpderecho-state.json contiene cf_clearance válida
  // (obtenida resolviendo el challenge una vez). Sin ella, Cloudflare
  // bloquea las requests consecutivas con "Just a moment...".
  const STATE_PATH = path.join(__dirname, '.lpderecho-state.json');
  const stateOptions = fs.existsSync(STATE_PATH) ? { storageState: STATE_PATH } : {};
  if (stateOptions.storageState) {
    console.log('🔑 Usando estado Cloudflare validado (.lpderecho-state.json)');
  } else {
    console.log('⚠️  Sin estado Cloudflare: solo funcionará la primera request. ' +
      'Ejecute una vez un navegador real para generar .lpderecho-state.json');
  }
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'es-PE',
    viewport: { width: 1366, height: 900 },
    ...stateOptions,
  });
  const page = await context.newPage();

  // 1) Sitemap index
  console.log('🗺️  Obteniendo sitemap_index.xml...');
  await page.goto(SITEMAP_INDEX, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('loc, urlset, sitemapindex', { timeout: 30000 }).catch(() => {});
  const indexXml = await page.evaluate(() => document.documentElement.textContent || document.body.textContent);
  const sitemapUrls = parseSitemapIndex(indexXml);
  const postSitemaps = sitemapUrls.filter((u) => /post-sitemap\d*\.xml/.test(u));
  console.log(`  Sitemap index: ${sitemapUrls.length} sitemaps, ${postSitemaps.length} de posts`);

  // 2) Extraer URLs de posts
  const allUrls = [];
  for (const sm of postSitemaps) {
    if (allUrls.length >= effectiveLimit) break;
    try {
      await page.goto(sm, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('url, loc', { timeout: 30000 }).catch(() => {});
      const xml = await page.evaluate(() => document.documentElement.textContent || document.body.textContent);
      const urls = parseSitemapUrls(xml);
      allUrls.push(...urls);
      console.log(`  ${sm}: ${urls.length} URLs (acumulado ${allUrls.length})`);
    } catch (e) {
      console.log(`  ⚠️ ${sm}: ${e.message}`);
    }
    await sleep(1200);
  }

  const finalUrls = allUrls.slice(0, effectiveLimit);
  console.log(`\n📚 Total URLs capturadas: ${finalUrls.length}`);

  // 3) Descargar contenido (opcional)
  let items = [];
  if (fetchCount > 0) {
    console.log(`\n📄 Descargando contenido de ${Math.min(fetchCount, finalUrls.length)} artículos...`);
    const batch = finalUrls.slice(0, fetchCount);
    for (const [i, url] of batch.entries()) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Esperar el cuerpo real del post (evita capturar el logo del header).
        // El catch() NO es suficiente: si el selector tarda, hay que reintentar.
        const contentReady = await (async () => {
          for (let attempt = 0; attempt < 12; attempt++) {
            const ok = await page.evaluate(() => {
              const bodyEl = document.querySelector('.td-post-content') || document.querySelector('.entry-content');
              const h1 = document.querySelector('h1.entry-title') || document.querySelector('.tdb-title-text');
              // Si aún muestra el challenge de Cloudflare, seguir esperando
              const isCF = /Just a moment|challenges\.cloudflare/i.test(document.body?.textContent?.slice(0, 500) || '');
              return !isCF && (bodyEl || h1) && document.querySelector('h1')?.textContent?.trim().length > 3;
            });
            if (ok) return true;
            await sleep(2500);
          }
          return false;
        })();
        if (!contentReady) {
          console.log(`  ⚠️ [${i + 1}] ${url}: contenido no disponible (CF o página muerta)`);
          items.push({ url, titulo: null, fecha: null, contenido: null, longitud: 0, error: 'no-content' });
          await sleep(800);
          continue;
        }
        const data = await page.evaluate(() => {
          const titleEl =
            document.querySelector('.tdb-title-text') ||
            document.querySelector('h1.entry-title') ||
            document.querySelector('article h1') ||
            document.querySelector('h1');
          const bodyEl = document.querySelector('.td-post-content') || document.querySelector('.entry-content');
          const dateEl =
            document.querySelector('.tdb-date, .entry-date, time') ||
            document.querySelector('meta[property="article:published_time"]');
          // Categorías: breadcrumb del post (primer bloque), no el menú global
          const crumb = document.querySelector('.tdb-breadcrumbs, .breadcrumb, .td-crumb-container');
          const categories = crumb
            ? Array.from(crumb.querySelectorAll('a'))
                .map((a) => a.textContent.trim())
                .filter(Boolean)
            : [];
          return {
            titulo: titleEl?.textContent?.trim() || null,
            contenido: bodyEl?.innerText?.replace(/\s+/g, ' ').trim() || null,
            fecha: dateEl?.getAttribute?.('datetime') || dateEl?.textContent?.trim() || null,
            categorias: categories.slice(0, 10),
            longitud: bodyEl?.innerText?.length || 0,
          };
        });
        items.push({ url, ...data });
        console.log(`  [${i + 1}/${batch.length}] ${(data.titulo || url).substring(0, 60)} (${data.longitud} chars)`);
      } catch (e) {
        items.push({ url, error: e.message });
        console.log(`  ⚠️ [${i + 1}] ${url}: ${e.message}`);
      }
      await sleep(800 + Math.random() * 700);
    }
  } else {
    items = finalUrls.map((url) => ({ url, titulo: null, fecha: null, contenido: null, longitud: 0 }));
  }

  await browser.close();

  // 4) Guardar snapshot
  const filename = `lpderecho-playwright-${new Date().toISOString().split('T')[0]}.json`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        fuente: 'lpderecho.pe',
        metodo: 'playwright-chromium',
        total_posts_estimado: finalUrls.length,
        capturados: items.length,
        con_contenido: items.filter((i) => i.contenido && i.contenido.length > 100).length,
        fecha: new Date().toISOString(),
        posts: items,
      },
      null,
      2
    ),
    'utf8'
  );

  const conContenido = items.filter((i) => i.contenido && i.contenido.length > 100).length;
  console.log(`\n✅ Snapshot guardado: ${outputPath}`);
  console.log(`   URLs: ${items.length} | con contenido: ${conContenido}`);
  console.log('   Próximo paso: indexar en RAG (tools/rag/index-corpus.mjs).');
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
