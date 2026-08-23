#!/usr/bin/env node
// tools/verifiers/verifier-outbox.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
let errs = 0;
console.log('=== Verifier: Outbox Pattern ===\n');
const checks = [
  { id: 'OUTBOX-01', file: 'catalogs/supabase-schema.md', pattern: 'CREATE TABLE outbox_messages|outbox_messages', name: 'Tabla outbox_messages' },
  { id: 'OUTBOX-02', file: 'LegalProBackend_Net/LegalPro.Infrastructure/BackgroundJobs/ProcessOutboxMessagesJob.cs', pattern: 'ProcessOutboxMessagesJob|BackgroundService', name: 'BackgroundService .NET' },
  { id: 'OUTBOX-03', file: 'LegalProBackend_Net/LegalPro.Infrastructure/BackgroundJobs/ProcessOutboxMessagesJob.cs', pattern: 'retry_count|retry|reintento', name: 'Retry logic' },
  { id: 'OUTBOX-04', file: 'LegalProBackend_Net/LegalPro.Infrastructure/BackgroundJobs/ProcessOutboxMessagesJob.cs', pattern: 'MarkAsFailed|DLQ|dead.letter', name: 'DLQ' }
];
for (const c of checks) {
  const p = resolve(ROOT, c.file);
  if (!existsSync(p)) { console.error(`FAIL: [${c.id}] file not found: ${c.file}`); errs++; continue; }
  const content = readFileSync(p, 'utf8');
  if (content.match(new RegExp(c.pattern, 'i'))) console.log(`OK: [${c.id}] ${c.name}`);
  else { console.error(`FAIL: [${c.id}] ${c.name}`); errs++; }
}
console.log(`\nErrores: ${errs}`);
process.exit(errs > 0 ? 1 : 0);
