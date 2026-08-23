import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import * as cache from '../cache.js';
import { TokenRepository } from '../repositories/TokenRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Límites desde SSOT: catalogs/role-tools.json ───────────────────────────
let LIMITES_MENSUALES_CONSULTAS = {};
try {
  const catalogPath = join(__dirname, '../../../catalogs/role-tools.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  for (const [planKey, planData] of Object.entries(catalog.planes)) {
    LIMITES_MENSUALES_CONSULTAS[planKey.toLowerCase()] = planData.max_consultas_ia_mes;
  }
  console.log('[quota] Límites cargados desde catálogo SSOT:', LIMITES_MENSUALES_CONSULTAS);
} catch (err) {
  console.error('[quota] Error cargando catálogo, usando defaults:', err.message);
  LIMITES_MENSUALES_CONSULTAS = {
    free: 50,
    pro: 1000,
    enterprise: 50000
  };
}

const tokenRepo = new TokenRepository(db);

// Memoria local como fallback de caché
const planCacheLocal = new Map();

async function obtenerPlanOrganizacion(orgId) {
  const cacheKey = `org-plan:${orgId}`;

  // 1. Intentar desde caché Redis
  if (cache.isAvailable()) {
    const cachedPlan = await cache.get(cacheKey);
    if (cachedPlan) return cachedPlan;
  } else {
    // 2. Intentar desde memoria local
    const item = planCacheLocal.get(orgId);
    if (item && Date.now() < item.expira) {
      return item.plan;
    }
  }

  // 3. Consultar DB si no está en caché
  const { rows } = await db.query(
    'SELECT plan FROM organizaciones WHERE id = $1 AND activo = TRUE',
    [orgId]
  );

  const plan = rows[0]?.plan ? rows[0].plan.toLowerCase() : 'free';

  // Guardar en caché por 1 hora
  if (cache.isAvailable()) {
    await cache.set(cacheKey, plan, 3600);
  } else {
    planCacheLocal.set(orgId, {
      plan,
      expira: Date.now() + 60 * 60 * 1000,
    });
  }

  return plan;
}

/**
 * Middleware de cuota de consumo de IA por organización.
 * Verifica que la organización no haya excedido su límite mensual de consultas de IA.
 *
 * @param {string} [tipo] - Tipo opcional de operación ('legal_query', 'chat', 'jurisprudencia', etc.).
 *                          Se usa para auditoría y trazabilidad granular. Por defecto usa 'consumo_ia'.
 */
export function quotaMiddleware(tipo) {
  return async (req, res, next) => {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(403).json({ error: 'Identificador de organización requerido.' });
    }

    try {
      // 1. Obtener el plan de la organización
      const plan = await obtenerPlanOrganizacion(orgId);
      const limiteMensual = LIMITES_MENSUALES_CONSULTAS[plan] || LIMITES_MENSUALES_CONSULTAS.free;

      // 2. Contar consultas realizadas en el mes actual para la organización
      const consultasMes = await tokenRepo.contarConsultasMes(orgId);
      const consultasRealizadas = consultasMes?.consultas_mes ?? 0;

      // 3. Validar límite mensual
      if (consultasRealizadas >= limiteMensual) {
        // Registrar bloqueo en audit_log para trazabilidad y seguridad (Auditoría)
        await db.query(
          `INSERT INTO audit_log (organization_id, usuario_id, tabla, operacion, registro_id, datos_anteriores, datos_nuevos, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            orgId,
            req.user?.sub || null,
            'consumo_tokens_ia',
            'UPDATE',
            `CUOTA_BLOQUEADA${tipo ? '_' + tipo.toUpperCase() : ''}`,
            JSON.stringify({ consultasRealizadas, limiteMensual, plan, tipo }),
            JSON.stringify({ error: 'Exceso de límite mensual de consultas de IA' }),
            req.ip || null,
            req.headers['user-agent'] || null
          ]
        ).catch(() => {}); // Fire and forget para no entorpecer el error del cliente

        return res.status(403).json({
          error: `Se ha alcanzado el límite mensual de consultas de IA para su organización (${consultasRealizadas}/${limiteMensual} consultas). Por favor, suba de plan o espere al próximo mes.`,
          code: 'QUOTA_EXCEEDED',
          consultasRealizadas,
          limiteMensual,
          plan,
          tipoOperacion: tipo || 'consumo_ia'
        });
      }

      // Adjuntar información de cuota en el request por si el endpoint lo necesita para la UI
      req.cuotaIA = {
        plan,
        limiteMensual,
        consultasRealizadas,
        consultasRestantes: Math.max(0, limiteMensual - consultasRealizadas),
        tipoOperacion: tipo || 'consumo_ia'
      };

      next();
    } catch (err) {
      console.error('[quota] Error en middleware de cuotas:', err);
      next(); // En caso de error interno, dejamos pasar por resiliencia operativa
    }
  };
}
