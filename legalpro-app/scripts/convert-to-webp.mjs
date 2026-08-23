// scripts/convert-to-webp.mjs
// Conversor one-shot PNG/JPEG >500KB a WebP (q=80) usando cwebp portable.
// No agrega dependencias al package.json; solo invoca el binario descargado.
//
// Uso: node scripts/convert-to-webp.mjs
//
// Estrategia:
//  - Lista assets >500KB (png/jpg/jpeg)
//  - Para cada uno, genera <nombre>.webp al lado (sin tocar el original)
//  - Reporta reducción de peso por archivo
//
// El .gitignore debe ignorar *.webp autogenerados si no se quieren trackear.

import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'src', 'assets');
const MIN_BYTES = 500 * 1024; // 500 KB
const CWEBP = path.join(
  process.env.TEMP || process.env.TMP || '/tmp',
  'cwebp',
  'libwebp-1.4.0-windows-x64',
  'bin',
  process.platform === 'win32' ? 'cwebp.exe' : 'cwebp'
);

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function convertOne(src) {
  const ext = path.extname(src).toLowerCase();
  const dst = src.replace(/\.(png|jpe?g)$/i, '.webp');
  if (ext === '.png') {
    // PNG iconos: q 82, mt multithread, m 6 (compression más fuerte).
    return runCwebp(['-q', '82', '-mt', '-m', '6', '-alpha_q', '90', src, '-o', dst]);
  }
  // JPEG (fondos, avatar): q 80, mt multithread, m 4 (más rápido).
  return runCwebp(['-q', '80', '-mt', '-m', '4', src, '-o', dst]);
}

function runCwebp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CWEBP, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`cwebp exit ${code}: ${stderr}`));
    });
  });
}

async function main() {
  console.log(`[webp] cwebp bin: ${CWEBP}`);
  console.log(`[webp] escaneando ${ASSETS} (>${MIN_BYTES / 1024} KB)...`);

  const candidates = [];
  for await (const file of walk(ASSETS)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
    const stat = await fs.stat(file);
    if (stat.size >= MIN_BYTES) candidates.push({ file, size: stat.size });
  }

  candidates.sort((a, b) => b.size - a.size);
  console.log(`[webp] candidatos: ${candidates.length}`);

  let totalIn = 0;
  let totalOut = 0;
  let ok = 0;
  let skip = 0;

  for (const { file, size } of candidates) {
    const ext = path.extname(file).toLowerCase();
    const dst = file.replace(/\.(png|jpe?g)$/i, '.webp');
    // Si el WebP ya existe y es más nuevo que el original, skip.
    try {
      const [srcStat, dstStat] = await Promise.all([fs.stat(file), fs.stat(dst)]);
      if (dstStat.mtimeMs >= srcStat.mtimeMs) {
        console.log(`[skip] ${path.relative(ROOT, file)} (webp más nuevo)`);
        totalIn += srcStat.size;
        totalOut += dstStat.size;
        skip++;
        continue;
      }
    } catch { /* dst no existe, continuar */ }

    try {
      const t0 = Date.now();
      await convertOne(file);
      const dstStat = await fs.stat(dst);
      const ms = Date.now() - t0;
      const ratio = ((dstStat.size / size) * 100).toFixed(1);
      console.log(`[ok]   ${path.relative(ROOT, file).padEnd(50)} ${(size/1024).toFixed(0).padStart(5)} KB → ${(dstStat.size/1024).toFixed(0).padStart(5)} KB (${ratio}%) ${ms}ms`);
      totalIn += size;
      totalOut += dstStat.size;
      ok++;
    } catch (err) {
      console.error(`[fail] ${path.relative(ROOT, file)}: ${err.message}`);
    }
  }

  console.log('---');
  console.log(`[webp] convertidos: ${ok}, saltados: ${skip}`);
  console.log(`[webp] entrada: ${(totalIn/1024/1024).toFixed(2)} MB`);
  console.log(`[webp] salida:  ${(totalOut/1024/1024).toFixed(2)} MB`);
  console.log(`[webp] reducción: ${(100 - (totalOut/totalIn*100)).toFixed(1)}%`);
}

main().catch((err) => {
  console.error('[webp] error fatal:', err);
  process.exit(1);
});
