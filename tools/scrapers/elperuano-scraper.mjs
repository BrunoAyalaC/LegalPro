#!/usr/bin/env node
/**
 * El Peruano Scraper - Descarga normas del Diario Oficial
 *
 * Uso:
 *   node tools/scrapers/elperuano-scraper.mjs                    # Normas de hoy
 *   node tools/scrapers/elperuano-scraper.mjs --date=2026-08-01  # Fecha específica
 *   node tools/scrapers/elperuano-scraper.mjs --days=7            # Últimos 7 días
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'catalogs', 'elperuano-snapshots');

const BASE_URL = 'https://busquedas.elperuano.pe/';

async function fetchNormasFecha(fecha) {
  const fechaCompact = fecha.replace(/-/g, '');
  const url = `${BASE_URL}?fechaIni=${fechaCompact}`;

  console.log(`📅 Scrapeando fecha: ${fecha}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'LegalPro-RAG-Bot/1.0' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();

  // Parsear HTML básico para extraer normas
  const normaRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g;
  const normas = [];
  let match;

  while ((match = normaRegex.exec(html)) !== null) {
    const texto = match[2].trim();
    if (
      texto.includes('DECRETO') ||
      texto.includes('RESOLUCIÓN') ||
      texto.includes('RESOLUCION') ||
      texto.includes('LEY') ||
      texto.includes('ORDENANZA')
    ) {
      normas.push({
        titulo: texto,
        url: match[1].startsWith('http')
          ? match[1]
          : `https://busquedas.elperuano.pe${match[1]}`,
        fecha_extraccion: new Date().toISOString(),
      });
    }
  }

  return {
    fecha,
    total: normas.length,
    normas: normas.slice(0, 100), // Límite de 100 por día
  };
}

async function main() {
  const args = process.argv.slice(2);
  const specificDate = args.find((a) => a.startsWith('--date='))?.split('=')[1];
  const days = parseInt(
    args.find((a) => a.startsWith('--days='))?.split('=')[1] || '1',
    10
  );

  console.log('🚀 El Peruano Scraper - LegalPro');
  console.log(`Fecha inicio: ${new Date().toISOString()}`);
  if (specificDate) console.log(`Fecha específica: ${specificDate}`);
  else console.log(`Días a procesar: ${days}`);
  console.log('');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const fechas = [];
  if (specificDate) {
    fechas.push(specificDate);
  } else {
    const hoy = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(hoy);
      d.setDate(d.getDate() - i);
      fechas.push(d.toISOString().split('T')[0]);
    }
  }

  const results = [];
  for (const fecha of fechas) {
    try {
      const data = await fetchNormasFecha(fecha);
      results.push(data);
      console.log(`   ✅ ${fecha}: ${data.total} normas`);
      await new Promise((r) => setTimeout(r, 2000)); // Rate limit
    } catch (err) {
      console.error(`   ❌ ${fecha}: ${err.message}`);
    }
  }

  // Guardar consolidado
  const filename = `elperuano-${new Date().toISOString().split('T')[0]}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(
    filepath,
    JSON.stringify(
      {
        periodo: fechas,
        total_dias: fechas.length,
        total_normas: results.reduce((sum, r) => sum + r.total, 0),
        detalle: results,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\n💾 Guardado: ${filename}`);
  console.log(`📊 Total normas: ${results.reduce((sum, r) => sum + r.total, 0)}`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
