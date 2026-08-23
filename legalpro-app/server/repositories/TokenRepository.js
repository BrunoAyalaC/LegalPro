import { BaseRepository } from './BaseRepository.js';
import * as cache from '../cache.js';

export class TokenRepository extends BaseRepository {
  /**
   * Calcula el costo estimado en USD de una llamada de IA basado en los precios de MiniMax.
   */
  calcularCosto(modelo, promptTokens, completionTokens) {
    const modelLower = modelo ? modelo.toLowerCase() : '';
    const isPro = modelLower.includes('pro');
    const isHighSpeed = modelLower.includes('highspeed') || modelLower.includes('lite');
    
    // Tarifas por token de MiniMax (en USD por token individual)
    // MiniMax M3 Pro: Input $1.25/M, Output $5.00/M
    // MiniMax M2.5 HighSpeed / Lite: Input $0.075/M, Output $0.30/M
    // MiniMax M3 base: Input $0.075/M, Output $0.30/M
    let TARIFA_INPUT = 0.000000075;
    let TARIFA_OUTPUT = 0.000000300;

    if (isPro) {
      TARIFA_INPUT = 0.000001250;
      TARIFA_OUTPUT = 0.000005000;
    } else if (isHighSpeed) {
      TARIFA_INPUT = 0.000000075;
      TARIFA_OUTPUT = 0.000000300;
    }

    const costoInput = promptTokens * TARIFA_INPUT;
    const costoOutput = completionTokens * TARIFA_OUTPUT;
    
    return parseFloat((costoInput + costoOutput).toFixed(8));
  }

  /**
   * Registra un consumo de tokens e IA en la base de datos de manera inmutable.
   */
  async registrarConsumo(usuarioId, orgId, tipoOperacion, modelo, promptTokens, completionTokens, idempotencyKey = null) {
    const totalTokens = promptTokens + completionTokens;
    const costoUsd = this.calcularCosto(modelo, promptTokens, completionTokens);

    const { rows } = await this.query(
      `INSERT INTO consumo_tokens_ia (
        usuario_id, organization_id, tipo_operacion, modelo, 
        prompt_tokens, completion_tokens, total_tokens, costo_usd, idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        usuarioId,
        orgId,
        tipoOperacion,
        modelo || 'unknown',
        promptTokens,
        completionTokens,
        totalTokens,
        costoUsd,
        idempotencyKey
      ]
    );

    return rows[0];
  }

  /**
   * Obtiene la suma acumulada de consumo de tokens y costo en dólares en el día actual para una organización.
   */
  async obtenerConsumoDiarioOrg(orgId) {
    const { rows } = await this.query(
      `SELECT 
        COALESCE(SUM(prompt_tokens), 0)::INTEGER as prompt_tokens,
        COALESCE(SUM(completion_tokens), 0)::INTEGER as completion_tokens,
        COALESCE(SUM(total_tokens), 0)::INTEGER as total_tokens,
        COALESCE(SUM(costo_usd), 0)::NUMERIC(12,8) as costo_total_usd
      FROM consumo_tokens_ia
      WHERE organization_id = $1 AND created_at >= CURRENT_DATE`,
      [orgId]
    );
    return rows[0];
  }

  /**
   * Cuenta las consultas de IA realizadas por una organización en el mes calendario actual.
   * Se usa para el nuevo modelo de cuotas (consultas/mes) en reemplazo del modelo diario en USD.
   */
  async contarConsultasMes(orgId) {
    // FIX P1 SARGable 2026-08-21: antes DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    // no usa índice (función sobre columna). Ahora >= date_trunc('month', now()) sí usa idx_consumo_org_month.
    // EXPLAIN ANALYZE debe mostrar Index Scan, p95 < 50ms.
    const { rows } = await this.query(
      `SELECT COUNT(*)::INTEGER as consultas_mes
       FROM consumo_tokens_ia
       WHERE organization_id = $1
         AND created_at >= date_trunc('month', now())`,
      [orgId]
    );
    return rows[0];
  }

  /**
   * Obtiene la suma acumulada de consumo de tokens y costo en dólares en el mes actual para una organización.
   */
  async obtenerConsumoMensualOrg(orgId) {
    const { rows } = await this.query(
      `SELECT 
        COALESCE(SUM(prompt_tokens), 0)::INTEGER as prompt_tokens,
        COALESCE(SUM(completion_tokens), 0)::INTEGER as completion_tokens,
        COALESCE(SUM(total_tokens), 0)::INTEGER as total_tokens,
        COALESCE(SUM(costo_usd), 0)::NUMERIC(12,8) as costo_total_usd
      FROM consumo_tokens_ia
      WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [orgId]
    );
    return rows[0];
  }

  /**
   * Verifica si existe una respuesta registrada bajo una llave de idempotencia.
   */
  async buscarPorIdempotencia(idempotencyKey) {
    if (!idempotencyKey) return null;
    const { rows } = await this.query(
      `SELECT * FROM consumo_tokens_ia WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    return rows[0] || null;
  }

  /**
   * Obtiene estadísticas de consumo agrupadas por usuario para una organización en un rango de fechas.
   * Útil para el panel de Owner / Admin.
   */
  async obtenerConsumoPorUsuarios(orgId, dias = 30) {
    const { rows } = await this.query(
      `SELECT 
        u.id as usuario_id,
        u.nombre_completo,
        u.email,
        u.rol,
        COALESCE(SUM(c.total_tokens), 0)::INTEGER as total_tokens,
        COALESCE(SUM(c.costo_usd), 0)::NUMERIC(12,8) as costo_total_usd,
        COUNT(c.id)::INTEGER as peticiones_realizadas
      FROM usuarios u
      LEFT JOIN consumo_tokens_ia c ON u.id = c.usuario_id AND c.created_at >= NOW() - INTERVAL '1 day' * $2
      WHERE u.organization_id = $1
      GROUP BY u.id, u.nombre_completo, u.email, u.rol
      ORDER BY costo_total_usd DESC`,
      [orgId, dias]
    );
    return rows;
  }

  /**
   * Obtiene la cantidad de créditos disponibles para una organización.
   * Cache 60s (Redis o memoria) para p95 < 50ms en alta concurrencia.
   */
  async verificarCreditos(orgId) {
    const cacheKey = `creditos:${orgId}`;
    // Intentar cache primero (60s TTL)
    try {
      const cached = await cache.get(cacheKey);
      if (cached !== null && cached !== undefined) return cached;
    } catch {}
    const { rows } = await this.query(
      'SELECT creditos_disponibles FROM organizaciones WHERE id = $1',
      [orgId]
    );
    const creditos = rows[0]?.creditos_disponibles ?? 0;
    try {
      await cache.set(cacheKey, creditos, 60);
    } catch {}
    return creditos;
  }

  /**
   * Debita créditos de una organización y registra la transacción.
   * Ejecutado dentro de una transacción serializable o FOR UPDATE para evitar race conditions.
   */
  async debitarCreditos(usuarioId, orgId, expedienteId, cantidad, motivo) {
    return this.transaction(async (client) => {
      // Lock de fila para prevenir lecturas sucias/race conditions
      const { rows } = await client.query(
        'SELECT creditos_disponibles FROM organizaciones WHERE id = $1 FOR UPDATE',
        [orgId]
      );
      
      if (rows.length === 0) {
        throw new Error('Organización no encontrada.');
      }

      const creditos = rows[0].creditos_disponibles;
      if (creditos < cantidad) {
        throw new Error(`Créditos insuficientes. Requerido: ${cantidad}, Disponible: ${creditos}`);
      }

      // Actualizar créditos disponibles
      await client.query(
        'UPDATE organizaciones SET creditos_disponibles = creditos_disponibles - $1 WHERE id = $2',
        [cantidad, orgId]
      );
      // Invalidar cache de creditos (60s) — forzar lectura fresca en próximo verificarCreditos
      try { await cache.del(`creditos:${orgId}`); } catch {}

      // Registrar la transacción (compatible schema legacy con precio_pagado/metodo_pago)
      const { rows: transRows } = await client.query(
        `INSERT INTO transacciones_creditos (
           organization_id, usuario_id, expediente_id, cantidad, tipo, motivo,
           precio_pagado, metodo_pago, estado, descripcion, tipo_operacion
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::integer, 'DEBITO', $5::text, 0, 'culqi', 'aprobado', $6::text, 'consumo_ia')
         RETURNING *`,
         [orgId, usuarioId, expedienteId || null, cantidad, motivo, motivo]
      );

      return {
        exito: true,
        creditosRestantes: creditos - cantidad,
        transaccion: transRows[0]
      };
    });
  }
}
