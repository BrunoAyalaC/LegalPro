#!/usr/bin/env node
/**
 * TC Scraper - Descarga últimas sentencias del TC
 * 
 * Uso:
 *   node tools/scrapers/tc-scraper.mjs                # Últimas 30 sentencias
 *   node tools/scrapers/tc-scraper.mjs --limit=100    # Últimas 100
 *   node tools/scrapers/tc-scraper.mjs --year=2026    # Solo 2026
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'catalogs', 'tc-snapshots');

async function scrapeUltimasSentencias(page, limit = 30) {
  console.log(`📜 Scrapeando últimas ${limit} sentencias del TC...`);

  await page.goto('https://www.tc.gob.pe/jurisprudencia-sistematizada/', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  // Esperar a que cargue la lista
  await page.waitForTimeout(3000);

  const sentencias = await page.evaluate((limit) => {
    // Buscar enlaces a sentencias
    const links = Array.from(document.querySelectorAll('a[href*="/jurisprudencia/"]'))
      .slice(0, limit)
      .map((a) => ({
        titulo: a.textContent.trim(),
        url: a.href,
        expediente: a.href.match(/exp[_-]?(\d+)/i)?.[1] || null,
      }));

    return {
      fecha_extraccion: new Date().toISOString(),
      total: links.length,
      sentencias: links,
    };
  }, limit);

  console.log(`   ✅ ${sentencias.total} sentencias encontradas`);
  return sentencias;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(
    args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '30',
    10
  );
  const year = args.find((a) => a.startsWith('--year='))?.split('=')[1];

  console.log('🚀 TC Scraper - LegalPro');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Límite: ${limit} sentencias`);
  if (year) console.log(`Año: ${year}`);
  console.log('');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const data = await scrapeUltimasSentencias(page, limit);

    if (year) {
      data.sentencias = data.sentencias.filter((s) => {
        const urlYear = s.url?.match(/\/(\d{4})\//)?.[1];
        return urlYear === year;
      });
      data.total = data.sentencias.length;
      data.filtro_year = year;
    }

    const filename = `tc-sentencias-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n💾 Guardado: ${filename}`);
    console.log(`📊 Total sentencias: ${data.total}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
