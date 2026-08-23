#!/usr/bin/env node
// tools/backup.mjs - Backup automático de PostgreSQL
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const FILENAME = `legalpro-backup-${TIMESTAMP}.sql`;

async function main() {
  console.log(`[backup] Iniciando backup...`);

  // Crear directorio si no existe
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[backup] DATABASE_URL no configurada');
    process.exit(1);
  }

  try {
    const filePath = path.join(BACKUP_DIR, FILENAME);
    execSync(`pg_dump "${dbUrl}" > "${filePath}"`, { stdio: 'pipe' });
    console.log(`[backup] Backup creado: ${filePath}`);

    // Limpiar backups antiguos (>7 días)
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    let deleted = 0;
    for (const f of files) {
      const fp = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
        fs.unlinkSync(fp);
        deleted++;
      }
    }
    console.log(`[backup] Backups antiguos eliminados: ${deleted}`);

  } catch (e) {
    console.error('[backup] Error:', e.message);
    process.exit(1);
  }
}

main();
