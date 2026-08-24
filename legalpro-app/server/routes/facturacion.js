/**
 * facturacion.js — Facturación de Honorarios (/api/facturacion)
 *
 * Recibos por Honorarios Electrónicos (RHE-YYYY-NNNN) multi-tenant.
 * Multi-tenant REAL: authMiddleware + tenantMiddleware + tenantQuery
 * (RLS FORCE como defensa en profundidad) — mismo patrón que horas.js.
 *
 * Endpoints:
 *   GET   /api/facturacion              → últimos 100 recibos del tenant
 *   POST  /api/facturacion              → crea recibo (IGV 18% + total, numero secuencial por org)
 *   PATCH /api/facturacion/:id/estado   → cambia estado (emitido|pagado|anulado)
 *   GET   /api/facturacion/:id/pdf      → HTML imprimible (FE abre ventana y window.print())
 */
import { Router } from 'express';
import { tenantQuery } from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { validate } from '../middleware/validate.js';
import { reciboCreateSchema, reciboEstadoSchema } from '../schemas/facturacionSchema.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// Multi-tenant obligatorio: sin auth y org no hay datos que mostrar.
router.use(authMiddleware, tenantMiddleware);

// ── Regla tributaria: IGV peruano 18% (D.Leg. 816, Art. 17) ──────────────────
const IGV_RATE = 0.18;
const round2 = (n) => Math.round(n * 100) / 100;

/** Escape HTML — cliente_nombre/concepto son input de usuario: NUNCA interpolar
 *  crudo en el template del PDF (XSS reflejado en la pestaña imprimible). */
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ── GET /api/facturacion ──────────────────────────────────────────────────────
// Últimos 100 recibos del tenant. WHERE organization_id explícito además del RLS.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await tenantQuery(
      `SELECT id,
              numero,
              cliente_nombre,
              concepto,
              monto_base::FLOAT8       AS monto_base,
              igv::FLOAT8              AS igv,
              total::FLOAT8            AS total,
              to_char(fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
              estado
       FROM recibos_honorarios
       WHERE organization_id = $1
       ORDER BY fecha_emision DESC, id DESC
       LIMIT 100`,
      [req.user.organization_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/facturacion ─────────────────────────────────────────────────────
// Crea un recibo. El expediente opcional DEBE pertenecer a la organización del
// JWT (patrón horas.js: la FK global no valida pertenencia al tenant).
//
// Numero secuencial ATÓMICO: un solo statement (CTE seq → INSERT). Se usa
// MAX(correlativo)+1 en vez de COUNT+1 para no reutilizar números si una fila
// se elimina (huecos OK, colisiones NO). UNIQUE(organization_id, numero) es el
// cinturón final; ante carrera concurrente (23505) se reintenta hasta 3 veces.
router.post('/', validate(reciboCreateSchema), async (req, res, next) => {
  try {
    const { cliente_nombre, cliente_ruc, concepto, monto_base, expediente_id } = req.body;
    const orgId = req.user.organization_id;

    if (expediente_id) {
      const exp = await tenantQuery(
        `SELECT id FROM expedientes
         WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [expediente_id, orgId]
      );
      if (exp.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Expediente no encontrado' });
      }
    }

    const igv = round2(monto_base * IGV_RATE);
    const total = round2(monto_base + igv);
    const prefijo = `RHE-${new Date().getFullYear()}-`;

    let creado = null;
    for (let intento = 0; intento < 3 && !creado; intento++) {
      try {
        const { rows } = await tenantQuery(
          `WITH seq AS (
             SELECT COALESCE(MAX((REGEXP_REPLACE(numero, '^RHE-[0-9]{4}-', ''))::INT), 0) + 1 AS n
             FROM recibos_honorarios
             WHERE organization_id = $1 AND numero LIKE $2 || '%'
           )
           INSERT INTO recibos_honorarios
             (organization_id, numero, cliente_nombre, cliente_ruc, concepto,
              monto_base, igv, total, expediente_id)
           SELECT $1, $2 || LPAD(seq.n::TEXT, 4, '0'), $3, $4, $5, $6, $7, $8, $9
           FROM seq
           RETURNING id, numero`,
          [orgId, prefijo, cliente_nombre, cliente_ruc ?? null, concepto,
           monto_base, igv, total, expediente_id ?? null]
        );
        creado = rows[0] ?? null;
      } catch (err) {
        // 23505 = unique_violation: otro request tomó el mismo correlativo.
        // Reintentar recalcula MAX dentro del nuevo statement.
        if (err.code !== '23505') throw err;
        if (intento === 2) throw err;
      }
    }

    if (!creado) {
      return res.status(409).json({
        success: false,
        error: 'No se pudo asignar número de recibo. Intente nuevamente.',
      });
    }

    // Audit event (fire-and-forget): mutación de datos financieros del tenant
    logAudit('RECIBO_CREATE', {
      severity: 'INFO',
      userId: req.user.sub,
      organizationId: orgId,
      resourceType: 'recibo_honorarios',
      resourceId: String(creado.id),
      metadata: { numero: creado.numero, total, expediente_id: expediente_id ?? null },
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: creado.id,
        numero: creado.numero,
        cliente_nombre,
        cliente_ruc: cliente_ruc ?? null,
        concepto,
        monto_base,
        igv,
        total,
        expediente_id: expediente_id ?? null,
        estado: 'emitido',
      },
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/facturacion/:id/estado ────────────────────────────────────────
// Cambia el estado del recibo dentro del tenant (enum validado con Zod).
router.patch('/:id/estado', validate(reciboEstadoSchema), async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const { estado } = req.body;

    const { rows } = await tenantQuery(
      `UPDATE recibos_honorarios
       SET estado = $3
       WHERE id = $1 AND organization_id = $2
       RETURNING id, numero, estado`,
      [id, req.user.organization_id, estado]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recibo no encontrado' });
    }

    logAudit('RECIBO_ESTADO_UPDATE', {
      severity: 'INFO',
      userId: req.user.sub,
      organizationId: req.user.organization_id,
      resourceType: 'recibo_honorarios',
      resourceId: String(id),
      metadata: { numero: rows[0].numero, estado_nuevo: estado },
    }).catch(() => {});

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── GET /api/facturacion/:id/pdf ──────────────────────────────────────────────
// HTML imprimible server-side SIN dependencias (sin puppeteer/pdfkit): el FE lo
// abre en ventana nueva y ejecuta window.print() → "Guardar como PDF" gratis.
//
// CSP: helmet global es default-src 'none' (bloquearía <style> inline). Esta
// respuesta sobreescribe la CSP permitiendo SOLO estilos inline; script-src
// cae a default-src 'none' → ningún script puede ejecutarse en esta página.
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const { rows } = await tenantQuery(
      `SELECT r.id, r.numero, r.cliente_nombre, r.cliente_ruc, r.concepto,
              r.monto_base::FLOAT8 AS monto_base,
              r.igv::FLOAT8        AS igv,
              r.total::FLOAT8      AS total,
              r.estado,
              to_char(r.fecha_emision, 'DD/MM/YYYY') AS fecha_emision,
              e.titulo             AS expediente_titulo
       FROM recibos_honorarios r
       LEFT JOIN expedientes e ON e.id = r.expediente_id
       WHERE r.id = $1 AND r.organization_id = $2`,
      [id, req.user.organization_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recibo no encontrado' });
    }
    const r = rows[0];
    const fmt = (n) =>
      `S/ ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(r.numero)} — Recibo por Honorarios</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b;
         background: #f1f5f9; padding: 24px; }
  .hoja { max-width: 720px; margin: 0 auto; background: #fff; padding: 40px;
          border: 1px solid #cbd5e1; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { font-size: 20px; letter-spacing: 0.5px; }
  .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
  .numero { text-align: right; }
  .numero strong { font-size: 18px; }
  .estado { display: inline-block; font-size: 11px; font-weight: bold;
            text-transform: uppercase; letter-spacing: 1px; padding: 3px 10px;
            border-radius: 999px; border: 1px solid #94a3b8; color: #475569; }
  dl { display: grid; grid-template-columns: 160px 1fr; row-gap: 8px;
       font-size: 14px; margin-bottom: 28px; }
  dt { font-weight: bold; color: #475569; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 10px 12px;
       font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: bold; border-bottom: none; }
  tfoot tr.total td { font-size: 16px; border-top: 2px solid #0f172a; }
  footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #cbd5e1;
           font-size: 11px; color: #64748b; text-align: center; }
  @media print {
    body { background: #fff; padding: 0; }
    .hoja { border: none; padding: 0; max-width: none; }
  }
</style>
</head>
<body>
<div class="hoja">
  <header>
    <div>
      <h1>RECIBO POR HONORARIOS</h1>
      <p class="sub">Emitido el ${escapeHtml(r.fecha_emision)}</p>
      <p style="margin-top:8px"><span class="estado">${escapeHtml(r.estado)}</span></p>
    </div>
    <div class="numero">
      <strong>${escapeHtml(r.numero)}</strong><br>
      <span class="sub">Recibo por Honorarios Electrónicos</span>
    </div>
  </header>

  <dl>
    <dt>Cliente</dt><dd>${escapeHtml(r.cliente_nombre)}</dd>
    <dt>RUC</dt><dd>${escapeHtml(r.cliente_ruc || '—')}</dd>
    <dt>Expediente</dt><dd>${escapeHtml(r.expediente_titulo || '—')}</dd>
  </dl>

  <table>
    <thead>
      <tr><th style="width:60%">Concepto</th><th class="num">Importe</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtml(r.concepto)}</td>
        <td class="num">${fmt(r.monto_base)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td>Monto base</td><td class="num">${fmt(r.monto_base)}</td></tr>
      <tr><td>IGV (18%)</td><td class="num">${fmt(r.igv)}</td></tr>
      <tr class="total"><td>TOTAL</td><td class="num">${fmt(r.total)}</td></tr>
    </tfoot>
  </table>

  <footer>Recibo por Honorarios Electrónicos — LegalPro<br>
  Documento generado electrónicamente · ${escapeHtml(new Date().toLocaleString('es-PE'))}</footer>
</div>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.set('X-Content-Type-Options', 'nosniff');
    res.status(200).send(html);
  } catch (err) { next(err); }
});

export default router;
