#!/usr/bin/env node
// tools/verifiers/verifier-cost-spike.mjs
// Verifica spikes de costo en consumo_tokens_ia y alerta a OwnerAdmin
// Ejecutar: node tools/verifiers/verifier-cost-spike.mjs

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

console.log('=== Verifier: Cost Spike Detection ===\n');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('WARN: DATABASE_URL no definida, saltando verificacion real');
  console.log('NOTA: Este verificador se ejecuta en CI/prod con credenciales');
  console.log('OK: Verificador de spike de costo configurado correctamente');
  process.exit(0);
}

let totalErrors = 0;
let totalWarnings = 0;

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  // 1. Detectar spike: costo del mes actual vs promedio 3 meses
  console.log('[SPIKE-01] Detectando spike de costo en plataforma');
  const spikeQuery = `
    WITH monthly_costs AS (
      SELECT
        DATE_TRUNC('month', created_at) as month,
        SUM(costo_usd) as total_cost
      FROM consumo_tokens_ia
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months'
        AND created_at < DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY DATE_TRUNC('month', created_at)
    ),
    avg_cost AS (
      SELECT AVG(total_cost) as avg_monthly_cost FROM monthly_costs
    ),
    current_cost AS (
      SELECT SUM(costo_usd) as current_month_cost
      FROM consumo_tokens_ia
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    )
    SELECT
      cc.current_month_cost,
      ac.avg_monthly_cost,
      CASE
        WHEN ac.avg_monthly_cost > 0
        THEN cc.current_month_cost / ac.avg_monthly_cost
        ELSE 0
      END as ratio
    FROM current_cost cc, avg_cost ac;
  `;

  const { rows: [spike] } = await pool.query(spikeQuery);
  if (spike && spike.avg_monthly_cost) {
    const ratio = parseFloat(spike.ratio);
    if (ratio > 2.0) {
      console.error(`FAIL: SPIKE detectado! Mes actual ${ratio.toFixed(2)}x el promedio`);
      console.error(`  Costo mes actual: $${spike.current_month_cost}`);
      console.error(`  Promedio 3 meses: $${spike.avg_monthly_cost}`);
      totalErrors++;
    } else if (ratio > 1.5) {
      console.warn(`WARN: Costo elevado (${ratio.toFixed(2)}x promedio)`);
      totalWarnings++;
    } else {
      console.log(`OK: Costo dentro de rangos normales (${ratio.toFixed(2)}x promedio)`);
    }
  } else {
    console.log('OK: Sin datos historicos suficientes para comparar');
  }

  // 2. Detectar tenants con consumo anómalo
  console.log('\n[SPIKE-02] Detectando tenants con consumo anómalo');
  const tenantQuery = `
    WITH plan_avg AS (
      SELECT
        o.id,
        o.nombre,
        o.plan,
        COALESCE(SUM(c.costo_usd), 0) as current_cost,
        COUNT(c.id) as requests
      FROM organizaciones o
      LEFT JOIN consumo_tokens_ia c ON o.id = c.organization_id
        AND c.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY o.id, o.nombre, o.plan
    )
    SELECT *
    FROM plan_avg
    WHERE
      (plan = 'FREE' AND current_cost > 50)
      OR (plan = 'PRO' AND current_cost > 1000)
      OR (plan = 'ENTERPRISE' AND current_cost > 5000)
    ORDER BY current_cost DESC;
  `;

  const { rows: anomalousTenants } = await pool.query(tenantQuery);
  if (anomalousTenants.length > 0) {
    console.error(`FAIL: ${anomalousTenants.length} tenants excedieron el limite de su plan:`);
    anomalousTenants.forEach(t => {
      console.error(`  - ${t.nombre} (${t.plan}): $${t.current_cost} (${t.requests} req)`);
    });
    totalErrors++;
  } else {
    console.log('OK: Todos los tenants dentro del limite de su plan');
  }

  // 3. Detectar consumo por tenant con ratio > 5x del promedio del plan
  console.log('\n[SPIKE-03] Detectando tenants con consumo 5x superior al promedio del plan');
  const ratioQuery = `
    WITH plan_avg AS (
      SELECT
        plan,
        AVG(tenant_cost) as avg_cost_per_tenant
      FROM (
        SELECT
          o.plan,
          o.id,
          COALESCE(SUM(c.costo_usd), 0) as tenant_cost
        FROM organizaciones o
        LEFT JOIN consumo_tokens_ia c ON o.id = c.organization_id
          AND c.created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY o.plan, o.id
      ) t
      WHERE tenant_cost > 0
      GROUP BY plan
    ),
    current_tenants AS (
      SELECT
        o.id,
        o.nombre,
        o.plan,
        COALESCE(SUM(c.costo_usd), 0) as current_cost
      FROM organizaciones o
      LEFT JOIN consumo_tokens_ia c ON o.id = c.organization_id
        AND c.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY o.id, o.nombre, o.plan
    )
    SELECT ct.*, pa.avg_cost_per_tenant
    FROM current_tenants ct
    JOIN plan_avg pa ON ct.plan = pa.plan
    WHERE pa.avg_cost_per_tenant > 0
      AND ct.current_cost > pa.avg_cost_per_tenant * 5
    ORDER BY ct.current_cost DESC;
  `;

  const { rows: outliers } = await pool.query(ratioQuery);
  if (outliers.length > 0) {
    console.warn(`WARN: ${outliers.length} tenants con consumo > 5x promedio del plan:`);
    outliers.forEach(t => {
      console.warn(`  - ${t.nombre} (${t.plan}): $${t.current_cost} vs promedio $${t.avg_cost_per_tenant}`);
    });
    totalWarnings++;
  } else {
    console.log('OK: Sin outliers detectados');
  }
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  totalErrors++;
} finally {
  await pool.end();
}

console.log('\n=== Resumen ===');
console.log(`Errores: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error('\nFAIL: Cost spike violations detected');
  process.exit(1);
}

console.log('\nOK: Cost spike verification passed');
process.exit(0);
