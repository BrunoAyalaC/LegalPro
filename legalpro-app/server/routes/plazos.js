import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
// FIX C-03: usar tenantMiddleware desde tenantMiddleware.js (no la versión "lite"
// de authMiddleware.js). La versión correcta envuelve next() en
// tenantContext.run(...) para activar las policies RLS en tenantQuery().
import { tenantMiddleware as tenantContextMiddleware } from '../middleware/tenantMiddleware.js';
import { sumarDiasHabiles, esDiaHabil, getDiasNoHabilesDelAnio } from '../utils/feriados.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getVencimientosPorOrganizacion,
  upsertOverride,
} from '../services/vencimientosService.js';
import { validate } from '../middleware/validate.js';
import { vencimientoUpdateSchema } from '../schemas/vencimientoSchema.js';
import { logAudit } from '../utils/audit.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLAZOS_PATH = join(__dirname, '../../../catalogs/plazos-procesales.json');

const router = Router();

function loadPlazos() {
  return JSON.parse(readFileSync(PLAZOS_PATH, 'utf-8'));
}

// POST /api/plazos/calcular
router.post('/calcular', authMiddleware, (req, res) => {
  try {
    const { plazo_id, fecha_inicio, dias } = req.body;

    if (!fecha_inicio) {
      return res.status(400).json({ error: 'fecha_inicio es requerida (YYYY-MM-DD)' });
    }

    let diasHabiles = dias;
    let plazoInfo = null;

    if (plazo_id) {
      const catalog = loadPlazos();
      plazoInfo = catalog.plazos.find(p => p.id === plazo_id);
      if (!plazoInfo) {
        return res.status(404).json({ error: `Plazo '${plazo_id}' no encontrado en catálogo` });
      }
      diasHabiles = plazoInfo.dias;
    }

    if (!diasHabiles) {
      return res.status(400).json({ error: 'Debe enviar plazo_id o dias' });
    }

    const fechaInicio = new Date(fecha_inicio + 'T00:00:00');
    const year = fechaInicio.getFullYear();

    const fechaVencimiento = sumarDiasHabiles(fecha_inicio, diasHabiles);
    const esHabil = esDiaHabil(fechaVencimiento);

    const inicio = fechaInicio;
    const fin = new Date(fechaVencimiento + 'T00:00:00');
    const diffDias = Math.round((fin - inicio) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      data: {
        plazo_id: plazo_id || null,
        plazo_info: plazoInfo,
        fecha_inicio,
        fecha_vencimiento: fechaVencimiento,
        dias_habiles: diasHabiles,
        dias_calendario_total: diffDias,
        es_habil: esHabil,
        feriados_del_anio: getDiasNoHabilesDelAnio(year),
        advertencia: !esHabil ? 'La fecha de vencimiento cayó en día inhábil (fin de semana o feriado), se prorrogó al siguiente día hábil según CPC Art. 144.' : null,
      },
    });
  } catch (err) {
    console.error('[plazos] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/plazos/catalogo - Listar plazos disponibles
router.get('/catalogo', (req, res) => {
  const catalog = loadPlazos();
  res.json({
    success: true,
    data: catalog.plazos.map(p => ({
      id: p.id,
      codigo: p.codigo,
      articulo: p.articulo,
      acto: p.acto,
      dias: p.dias,
      tipo: p.tipo,
    })),
  });
});

// GET /api/plazos/vencimientos - Próximos vencimientos de plazos procesales del tenant
// Aplica overrides manuales (drag & drop + completado) en el servicio.
// Autenticado + tenant. Filtro opcional ?dias=N (default 30, máx 90).
// Respuesta: { success, data: { vencimientos, total, generado_en, org_id }, error }
router.get('/vencimientos', authMiddleware, tenantContextMiddleware, async (req, res) => {
  try {
    const orgId = req.organizationId;
    const rawDias = parseInt(req.query.dias, 10);
    const dias = Number.isFinite(rawDias) && rawDias > 0 ? Math.min(rawDias, 90) : 30;

    const resultado = await getVencimientosPorOrganizacion(orgId, { dias });

    res.json({
      success: true,
      data: resultado,
      error: null,
    });
  } catch (err) {
    console.error('[plazos/vencimientos] Error:', err);
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

// PATCH /api/plazos/vencimientos/:key
//   :key = `${expediente_id}::${evento}` (URL-encoded por el cliente).
//   Body: { nueva_fecha_limite?: 'YYYY-MM-DD', completado?: boolean }
//
//   - Persiste en `vencimientos_overrides` via upsert (ON CONFLICT).
//   - Multi-tenant: WHERE organization_id = req.organizationId (validado en JWT).
//   - Audit: VENCIMIENTO_ACTUALIZADO con userId, organizationId, expedienteId, evento.
//   - Idempotente vía opcional `Idempotency-Key` header.
//
//   Status:
//     200 OK             — override aplicado (devuelve fila y los items efectivos).
//     400 Bad Request    — body inválido.
//     401 Unauthorized   — token ausente/inválido.
//     403 Forbidden      — sin organización o expediente no pertenece al tenant.
//     404 Not Found      — expediente no existe.
//     500 Internal Error — error de BD.
router.patch(
  '/vencimientos/:key',
  authMiddleware,
  tenantContextMiddleware,
  idempotencyMiddleware(),
  validate(vencimientoUpdateSchema),
  async (req, res) => {
    try {
      const orgId = req.organizationId;
      const userId = req.user?.sub || req.user?.id || null;
      const rawKey = req.params.key || '';
      const decoded = decodeURIComponent(rawKey);
      const sep = decoded.indexOf('::');
      if (sep <= 0 || sep === decoded.length - 2) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Parámetro :key inválido. Formato esperado: <expediente_id>::<evento>.',
        });
      }

      const expedienteId = decoded.slice(0, sep);
      const evento = decoded.slice(sep + 2);

      // UUID v1-5: 8-4-4-4-12 hex
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(expedienteId)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'expediente_id (en :key) no es un UUID válido.',
        });
      }
      if (!evento || evento.length > 100) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'evento (en :key) inválido.',
        });
      }

      // Verifica que el expediente pertenezca al tenant (defensa contra cross-tenant).
      const { tenantQuery } = await import('../db.js');
      const expCheck = await tenantQuery(
        `SELECT id FROM expedientes WHERE id = $1 AND organization_id = $2 LIMIT 1`,
        [expedienteId, orgId]
      );
      if (expCheck.rowCount === 0) {
        return res.status(404).json({
          success: false,
          data: null,
          error: 'Expediente no encontrado en esta organización.',
        });
      }

      const body = req.body || {};
      const nuevaFecha = body.nueva_fecha_limite !== undefined ? body.nueva_fecha_limite : null;
      const completado = body.completado !== undefined ? body.completado : null;

      const fila = await upsertOverride({
        organizationId: orgId,
        expedienteId,
        evento,
        nuevaFechaLimite: nuevaFecha,
        completado,
        completadoPor: userId,
      });

      // Devuelve también el item efectivo (con overrides aplicados) para que el
      // frontend pueda actualizar su estado local sin un GET extra.
      const { getVencimientosPorOrganizacion: _get } = await import('../services/vencimientosService.js');
      const refresco = await _get(orgId, { dias: 30 });
      const itemEfectivo = (refresco.vencimientos || []).find(
        (v) => v.expediente_id === expedienteId && v.evento === evento
      ) || null;

      // Auditoría: VENCIMIENTO_ACTUALIZADO (catalogs/audit-events.json).
      // Fire-and-forget: no bloquea la respuesta.
      logAudit('VENCIMIENTO_ACTUALIZADO', {
        severity: 'INFO',
        userId,
        organizationId: orgId,
        ip: req.ip,
        expediente_id: expedienteId,
        evento,
        nueva_fecha_limite: nuevaFecha,
        completado,
      }).catch(() => {});

      return res.json({
        success: true,
        data: {
          override: fila,
          item: itemEfectivo,
        },
        error: null,
      });
    } catch (err) {
      console.error('[plazos/vencimientos PATCH] Error:', err);
      return res.status(500).json({ success: false, data: null, error: err.message });
    }
  }
);

export default router;
