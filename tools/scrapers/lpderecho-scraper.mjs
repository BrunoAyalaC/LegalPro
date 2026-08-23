#!/usr/bin/env node
/**
 * LP Derecho Scraper - Captura leyes y jurisprudencia peruana
 *
 * lpderecho.pe es WordPress pero su API REST devuelve 401 (no pública).
 * Este scraper usa Playwright para extraer el HTML de las páginas
 * de categoría y los artículos de legislación/jurisprudencia.
 *
 * Datos reales (agosto 2026, del footer del sitio):
 *   - Total publicaciones: ~30,591
 *   - Normas legales: ~5,278
 *   - Casación: ~9,391
 *   - Penal: ~18,836
 *
 * Uso:
 *   node tools/scrapers/lpderecho-scraper.mjs                   # Últimas 20
 *   node tools/scrapers/lpderecho-scraper.mjs --category=legislacion
 *   node tools/scrapers/lpderecho-scraper.mjs --limit=100
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUTPUT_DIR = path.join(process.cwd(), 'catalogs', 'lpderecho-snapshots');

const CATEGORIAS = {
  legislacion: 'legislacion',
  normas: 'legislacion-basica',
  casacion: 'jurisprudencia/casacion',
  penal: 'derecho-penal',
  civil: 'civil',
  laboral: 'laboral',
  constitucional: 'derecho-constitucional',
  modelos: 'modelos',
};

async function scrapeCategoria(page, categorySlug, limit) {
  const url = `https://lpderecho.pe/category/${categorySlug}/`;
  console.log(`\n📂 Categoría: ${categorySlug} → ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Extraer links de artículos
  const articulos = await page.evaluate(() => {
    const links = [...document.querySelectorAll('h2 a, h3 a, .entry-title a, article a')];
    const seen = new Set();
    const result = [];
    for (const a of links) {
      const href = a.href || '';
      const title = (a.textContent || '').trim();
      if (href.includes('lpderecho.pe') && !href.includes('/category/') && title.length > 10) {
        if (!seen.has(href)) {
          seen.add(href);
          result.push({ titulo: title, url: href });
        }
      }
    }
    return result;
  });

  return articulos.slice(0, limit);
}

async function scrapeArticulo(page, articulo) {
  try {
    await page.goto(articulo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const content = await page.evaluate(() => {
      // Quitar scripts y estilos
      document.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
      const main = document.querySelector('article, .entry-content, .post-content') || document.body;
      return (main.innerText || '').substring(0, 8000);
    });
    return {
      ...articulo,
      contenido: content.replace(/\n{3,}/g, '\n\n').trim(),
      fecha_captura: new Date().toISOString(),
    };
  } catch (err) {
    return { ...articulo, contenido: `ERROR: ${err.message}`, fecha_captura: new Date().toISOString() };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const category = args.find(a => a.startsWith('--category='))?.split('=')[1];
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '20');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (LegalPro-RAG-Bot/1.0)',
  });

  const slugs = category ? [CATEGORIAS[category] || category] : Object.values(CATEGORIAS);

  const resultados = [];
  for (const slug of slugs) {
    try {
      const articulos = await scrapeCategoria(page, slug, limit);
      console.log(`   Encontrados: ${articulos.length} artículos`);
      for (const art of articulos) {
        const detalle = await scrapeArticulo(page, art);
        resultados.push(detalle);
        console.log(`   ✓ ${detalle.titulo.substring(0, 60)}`);
        await new Promise(r => setTimeout(r, 1500)); // rate limit
      }
    } catch (err) {
      console.log(`   ✗ Error en ${slug}: ${err.message}`);
    }
  }

  await browser.close();

  const filename = `lpderecho-${category || 'multi'}-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), JSON.stringify({
    fuente: 'lpderecho.pe',
    categorias: slugs,
    capturados: resultados.length,
    fecha: new Date().toISOString(),
    posts: resultados,
  }, null, 2), 'utf8');

  console.log(`\n✅ Guardados ${resultados.length} artículos en ${filename}`);
  console.log('📊 Estadísticas del sitio (footer LP): total ~30,591 | normas ~5,278 | casación ~9,391');
}

main().catch(err => {
  console.error('💥 Error fatal:', err.message);
  process.exit(1);
});
