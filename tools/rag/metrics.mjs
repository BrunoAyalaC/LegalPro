#!/usr/bin/env node
/**
 * RAG Metrics - Métricas de calidad y performance del sistema RAG.
 *
 * Umbrales: precision@k >= 0.85, recall@k >= 0.90,
 * citation accuracy >= 0.98, hallucination rate < 0.02,
 * context relevance >= 0.80, answer relevance >= 0.85,
 * latencia p95 < 3000 ms y costo promedio < USD 0.10/request.
 */

import pg from 'pg';
import { pathToFileURL } from 'node:url';

const THRESHOLDS = Object.freeze({
  retrieval_precision_at_k: { operator: 'min', value: 0.85 },
  retrieval_recall_at_k: { operator: 'min', value: 0.90 },
  citation_accuracy: { operator: 'min', value: 0.98 },
  hallucination_rate: { operator: 'maxExclusive', value: 0.02 },
  context_relevance_score: { operator: 'min', value: 0.80 },
  answer_relevance_score: { operator: 'min', value: 0.85 },
  latency_p95_ms: { operator: 'maxExclusive', value: 3000 },
  average_cost_usd: { operator: 'maxExclusive', value: 0.10 }
});

class RAGMetrics {
  constructor(dbConfig) {
    this.db = dbConfig;
    this.client = null;
  }

  async connect() {
    this.client = new pg.Client({ connectionString: this.db });
    await this.client.connect();
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  assertConnected() {
    if (!this.client) throw new Error('RAGMetrics no está conectado a PostgreSQL');
  }

  async queryForPeriod(sql, days) {
    this.assertConnected();
    return this.client.query(sql, [days]);
  }

  async getUsageMetrics(days = 7) {
    const sql = `
      SELECT
        DATE(created_at) AS fecha,
        COUNT(*) AS total_consultas,
        COUNT(DISTINCT organization_id) AS orgs_activas,
        AVG(similitud_promedio) AS similitud_avg
      FROM rag_audit_log
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
      GROUP BY DATE(created_at)
      ORDER BY fecha DESC
    `;
    return (await this.queryForPeriod(sql, days)).rows;
  }

  async getLatencyMetrics(days = 7) {
    const sql = `
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99,
        MAX(latency_ms) AS max,
        AVG(latency_ms) AS avg
      FROM rag_audit_log
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
        AND latency_ms IS NOT NULL
    `;
    return (await this.queryForPeriod(sql, days)).rows[0];
  }

  async getCostMetrics(days = 30) {
    const sql = `
      SELECT
        proveedor_embeddings,
        COUNT(*) AS total_requests,
        SUM(costo_usd) AS costo_total,
        AVG(costo_usd) AS costo_promedio
      FROM rag_audit_log
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
        AND costo_usd IS NOT NULL
      GROUP BY proveedor_embeddings
    `;
    return (await this.queryForPeriod(sql, days)).rows;
  }

  async getCitationAccuracy(days = 7) {
    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE citaciones_verificadas = true) AS correctas,
        COUNT(*) FILTER (WHERE citaciones_verificadas = false) AS incorrectas,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE citaciones_verificadas = true)::float /
          NULLIF(COUNT(*), 0) AS accuracy
      FROM rag_audit_log
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
    `;
    return (await this.queryForPeriod(sql, days)).rows[0];
  }

  async getHallucinationMetrics(days = 7) {
    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE alucinaciones_detectadas > 0) AS con_alucinaciones,
        COUNT(*) AS total,
        SUM(alucinaciones_detectadas) AS total_alucinaciones,
        COUNT(*) FILTER (WHERE alucinaciones_detectadas > 0)::float /
          NULLIF(COUNT(*), 0) AS rate
      FROM rag_audit_log
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
    `;
    return (await this.queryForPeriod(sql, days)).rows[0];
  }

  async getQualityMetrics(days = 7) {
    const sql = `
      SELECT
        AVG(retrieval_precision_at_k) AS retrieval_precision_at_k,
        AVG(retrieval_recall_at_k) AS retrieval_recall_at_k,
        AVG(context_relevance_score) AS context_relevance_score,
        AVG(answer_relevance_score) AS answer_relevance_score
      FROM rag_audit_log
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
    `;
    return (await this.queryForPeriod(sql, days)).rows[0];
  }

  async getMateriasDistribution(days = 30) {
    const sql = `
      SELECT materia, COUNT(*) AS total
      FROM rag_audit_log
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
      GROUP BY materia
      ORDER BY total DESC
    `;
    return (await this.queryForPeriod(sql, days)).rows;
  }

  async generateReport(days = 7) {
    const [uso, latencia, costos, citaciones, alucinaciones, calidad, topMaterias] = await Promise.all([
      this.getUsageMetrics(days),
      this.getLatencyMetrics(days),
      this.getCostMetrics(days * 4),
      this.getCitationAccuracy(days),
      this.getHallucinationMetrics(days),
      this.getQualityMetrics(days),
      this.getMateriasDistribution(days)
    ]);

    return {
      periodo: `Últimos ${days} días`,
      uso,
      latencia,
      costos,
      citaciones,
      alucinaciones,
      calidad,
      top_materias: topMaterias,
      generado_en: new Date().toISOString()
    };
  }
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateThresholds(report) {
  const averageCost = report.costos.reduce(
    (sum, item) => sum + (toNumber(item.costo_total) ?? 0),
    0
  ) / Math.max(report.costos.reduce((sum, item) => sum + Number(item.total_requests || 0), 0), 1);

  const values = {
    ...report.calidad,
    citation_accuracy: report.citaciones.accuracy,
    hallucination_rate: report.alucinaciones.rate,
    latency_p95_ms: report.latencia.p95,
    average_cost_usd: averageCost
  };

  const alerts = [];
  for (const [metric, threshold] of Object.entries(THRESHOLDS)) {
    const value = toNumber(values[metric]);
    if (value === null) {
      alerts.push(`${metric}: sin datos para evaluar`);
      continue;
    }

    const breached = threshold.operator === 'min'
      ? value < threshold.value
      : value >= threshold.value;
    if (breached) alerts.push(`${metric}: ${value} incumple umbral ${threshold.operator} ${threshold.value}`);
  }
  return alerts;
}

async function main() {
  const days = Number.parseInt(process.argv[2] || '7', 10);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('El período debe ser un entero entre 1 y 365 días');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurada');

  const metrics = new RAGMetrics(process.env.DATABASE_URL);
  await metrics.connect();

  try {
    const report = await metrics.generateReport(days);
    console.log(JSON.stringify(report, null, 2));

    const alerts = validateThresholds(report);
    if (alerts.length > 0) {
      console.error('\nALERTAS RAG:');
      alerts.forEach((alert) => console.error(`- ${alert}`));
      process.exitCode = 1;
    } else {
      console.log('\nTodas las métricas RAG están dentro de los umbrales.');
    }
  } finally {
    await metrics.disconnect();
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(`Error generando métricas RAG: ${error.message}`);
    process.exitCode = 1;
  });
}

export { THRESHOLDS, validateThresholds };
export default RAGMetrics;
