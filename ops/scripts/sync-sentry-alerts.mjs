#!/usr/bin/env node
/**
 * sync-sentry-alerts.mjs
 *
 * Sincroniza declarativamente los Monitors de Sentry definidos en
 * ops/sentry/rag-alerts.yml contra la organización de Sentry.
 *
 * Idempotente: crea, actualiza o elimina Monitors según diff.
 *
 * Variables de entorno requeridas:
 *   SENTRY_AUTH_TOKEN   Token de Sentry con scope `alert:write`
 *   SENTRY_ORG          Slug de la organización (ej: legalpro)
 *
 * Uso:
 *   node ops/scripts/sync-sentry-alerts.mjs --config ops/sentry/rag-alerts.yml --dry-run
 *   node ops/scripts/sync-sentry-alerts.mjs --config ops/sentry/rag-alerts.yml
 *
 * Por cada monitor en el YAML:
 *   - Si no existe en Sentry (búsqueda por nombre) → POST /monitors/
 *   - Si existe con mismo `name` → PATCH con la nueva config
 *   - Si existe en Sentry pero NO en el YAML → DELETE (opcional con --prune)
 *
 * SKILL: alertmanager-ruler
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';

// ─── CLI args ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, prune: false, config: null };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--config') args.config = argv[++i];
    else if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--prune') args.prune = true;
    else if (flag === '--help' || flag === '-h') {
      console.log('Uso: node ops/scripts/sync-sentry-alerts.mjs --config <yaml> [--dry-run] [--prune]');
      process.exit(0);
    } else {
      console.error(`Flag desconocida: ${flag}`);
      process.exit(2);
    }
  }
  if (!args.config) {
    console.error('ERROR: --config es obligatorio');
    process.exit(2);
  }
  return args;
}

// ─── Cliente Sentry ─────────────────────────────────────────────────────────

class SentryClient {
  constructor({ org, token }) {
    this.org = org;
    this.token = token;
    this.base = `https://sentry.io/api/0/organizations/${org}`;
  }

  async _request(method, path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sentry API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listProjects() {
    return this._request('GET', '/projects/');
  }

  /**
   * Lista los Monitors (metric alerts) de la organización.
   * Endpoint: GET /organizations/{org}/monitors/
   */
  async listMonitors() {
    return this._request('GET', '/monitors/?per_page=200');
  }

  async createMonitor(monitor) {
    return this._request('POST', '/monitors/', monitor);
  }

  async updateMonitor(monitorId, monitor) {
    return this._request('PUT', `/monitors/${monitorId}/`, monitor);
  }

  async deleteMonitor(monitorId) {
    return this._request('DELETE', `/monitors/${monitorId}/`);
  }
}

// ─── Conversión YAML → payload Sentry ────────────────────────────────────────

/**
 * Traduce un monitor de nuestro formato declarativo al payload
 * que espera POST /api/0/organizations/{org}/monitors/.
 *
 * Ref: https://docs.sentry.io/api/organizations/create-a-metric-monitor/
 */
function toSentryMonitor(monitorYaml, integrationIds) {
  const projectSlug = monitorYaml.project;
  const actions = (monitorYaml.actions ?? []).map((action) => {
    if (action.type === 'slack') {
      const integrationId = integrationIds[action.integration_id_ref];
      if (!integrationId) throw new Error(`Integration ${action.integration_id_ref} no definida`);
      return {
        type: 'slack',
        integrationId,
        targetIdentifier: action.channel?.replace(/^#/, ''),
        targetType: 'specific',
      };
    }
    if (action.type === 'email') {
      return {
        type: 'email',
        integrationId: integrationIds.email_legalpro ?? null,
        targetType: 'specific',
        targetIdentifier: action.to,
      };
    }
    if (action.type === 'pagerduty') {
      const integrationId = integrationIds[action.integration_id_ref];
      if (!integrationId) throw new Error(`Integration ${action.integration_id_ref} no definida`);
      return {
        type: 'pagerduty',
        integrationId,
        targetIdentifier: action.service,
        targetType: 'specific',
      };
    }
    throw new Error(`Tipo de acción no soportado: ${action.type}`);
  });

  // Mapeo de severidad → priority (Sentry usa low/medium/high)
  const priorityMap = { low: 'low', medium: 'medium', high: 'high', critical: 'high' };

  return {
    name: monitorYaml.name,
    type: 'metric_issue',
    projectSlug,
    environment: monitorYaml.environment,
    queryType: 1, // 1 = aggregate, ver API
    dataset: monitorYaml.metric === 'custom' ? 'generic_metrics' : 'transactions',
    query: monitorYaml.query,
    thresholdType: 0, // 0 = absolute
    threshold: monitorYaml.threshold,
    timeWindow: monitorYaml.time_window_minutes,
    frequency: monitorYaml.frequency_minutes,
    comparison: monitorYaml.comparison === 'less' ? -1
              : monitorYaml.comparison === 'greater' ? 1
              : monitorYaml.comparison === 'equal' ? 0
              : 1, // default greater
    alertRule: {
      name: monitorYaml.name,
      summary: monitorYaml.description,
      runbookUrl: monitorYaml.runbook,
    },
    actions,
  };
}

// ─── Diff + Sync ────────────────────────────────────────────────────────────

async function sync() {
  const args = parseArgs(process.argv);

  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  if (!token || !org) {
    console.error('ERROR: SENTRY_AUTH_TOKEN y SENTRY_ORG son obligatorios');
    process.exit(2);
  }

  const configPath = resolve(args.config);
  const raw = await readFile(configPath, 'utf8');
  const config = parseYAML(raw);

  const client = new SentryClient({ org, token });
  console.log(`Sincronizando ${config.monitors.length} monitors contra Sentry org=${org}…`);

  // 1. Listar Monitors existentes
  const existing = await client.listMonitors();
  const existingByName = new Map(existing.map((m) => [m.name, m]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const monitor of config.monitors) {
    try {
      const payload = toSentryMonitor(monitor, config.sentry_integrations);
      const found = existingByName.get(monitor.name);

      if (args.dryRun) {
        console.log(`  [dry-run] ${found ? 'UPDATE' : 'CREATE'} ${monitor.name}`);
        continue;
      }

      if (found) {
        await client.updateMonitor(found.id, payload);
        console.log(`  ✓ UPDATED ${monitor.name} (id=${found.id})`);
        updated++;
      } else {
        const created2 = await client.createMonitor(payload);
        console.log(`  + CREATED ${monitor.name} (id=${created2.id})`);
        created++;
      }
    } catch (err) {
      console.error(`  ✗ ERROR ${monitor.name}: ${err.message}`);
      errors++;
    }
  }

  // 2. Prune (opcional): eliminar monitors que están en Sentry pero no en YAML
  if (args.prune) {
    const yamlNames = new Set(config.monitors.map((m) => m.name));
    for (const e of existing) {
      if (!yamlNames.has(e.name) && e.name.startsWith('RAG ')) {
        if (args.dryRun) {
          console.log(`  [dry-run] DELETE ${e.name} (id=${e.id})`);
        } else {
          await client.deleteMonitor(e.id);
          console.log(`  - DELETED ${e.name} (id=${e.id})`);
        }
      }
    }
  } else {
    unchanged = existing.length - updated;
  }

  console.log(
    `\nResumen: created=${created} updated=${updated} unchanged=${unchanged} errors=${errors}`,
  );
  if (errors > 0) process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === fileURLToPath(process.argv[1]);
if (isMain) {
  sync().catch((err) => {
    console.error(`Error fatal: ${err.message}`);
    process.exit(1);
  });
}

export { toSentryMonitor };
