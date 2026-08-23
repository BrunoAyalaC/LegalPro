import { Router } from 'express';
import db, { tenantQuery } from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { validate } from '../middleware/validate.js';
import { clienteCreateSchema, clienteUpdateSchema } from '../schemas/clienteSchema.js';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// FIX P0-E: dual-write PII (dni/ruc) — transición pgcrypto
//   - *_hash: SHA-256 hex de lower(trim(valor)), calculado EN SQL con
//     encode(digest(...,'sha256'),'hex') para que escritura y búsqueda usen
//     la misma normalización y aprovechen uq_clientes_dni_hash/ruc_hash.
//   - *_enc: encode(pgp_sym_encrypt(valor, PGCRYPTO_KEY),'base64'). La clave
//     viaja SIEMPRE como parámetro ($N), nunca interpolada en el SQL.
//   - Degradación: si PGCRYPTO_KEY no está definida → warning UNA vez y
//     solo-hash (columnas _enc no se escriben). Dual-write mantiene dni/ruc
//     claros hasta completar la transición.
// ─────────────────────────────────────────────────────────────────────────────
const PII_HASH_SQL = (p) =>
  `CASE WHEN $${p}::text IS NOT NULL THEN encode(digest(lower(trim($${p}::text)), 'sha256'), 'hex') END`;
const PII_ENC_SQL = (p, k) =>
  `CASE WHEN $${p}::text IS NOT NULL THEN encode(pgp_sym_encrypt($${p}::text, $${k}::text), 'base64') END`;

let _warnedNoPgcryptoKey = false;
function getPgcryptoKey() {
  const key = process.env.PGCRYPTO_KEY;
  if (!key) {
    if (!_warnedNoPgcryptoKey) {
      _warnedNoPgcryptoKey = true;
      console.warn(
        '[clientes] PGCRYPTO_KEY no definida: degradando a solo-hash ' +
        '(dni_enc/ruc_enc NO se cifrarán). Define PGCRYPTO_KEY para dual-write completo.'
      );
    }
    return null;
  }
  return key;
}

// GET /api/clientes - Listar con búsqueda
router.get('/', async (req, res, next) => {
  try {
    const { search, tipo, limit = 50, offset = 0 } = req.query;
    const params = [req.user.organization_id];
    let where = 'organization_id = $1 AND eliminado_en IS NULL';

    if (search) {
      params.push(`%${search}%`);
      // FIX P0-E: búsqueda exacta por documento vía hash (usa índices
      // uq_clientes_dni_hash / uq_clientes_ruc_hash en vez del dato claro).
      params.push(String(search).trim());
      where += ` AND (nombre_completo ILIKE $2 OR razon_social ILIKE $2
        OR dni_hash = encode(digest(lower(trim($3::text)), 'sha256'), 'hex')
        OR ruc_hash = encode(digest(lower(trim($3::text)), 'sha256'), 'hex'))`;
    }
    if (tipo) {
      params.push(tipo);
      where += ` AND tipo_persona = $${params.length}`;
    }
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await tenantQuery(
      `SELECT id, tipo_persona, nombre_completo, dni, razon_social, ruc, email, telefono, distrito, created_at
       FROM clientes WHERE ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await tenantQuery(
      `SELECT * FROM clientes WHERE id = $1 AND organization_id = $2 AND eliminado_en IS NULL`,
      [req.params.id, req.user.organization_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    // FIX P0-E: no exponer columnas internas de pseudonimizado/cifrado
    const data = { ...rows[0] };
    delete data.dni_hash; delete data.dni_enc; delete data.ruc_hash; delete data.ruc_enc;
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/clientes - Crear (validado con Zod)
router.post('/', validate(clienteCreateSchema), async (req, res, next) => {
  try {
    const { tipo_persona, nombre_completo, dni, fecha_nacimiento, estado_civil, razon_social, ruc, representante_legal, email, telefono, direccion, distrito, provincia, departamento, notas } = req.body;
    const params = [
      req.user.organization_id, tipo_persona || 'natural', nombre_completo,
      dni, fecha_nacimiento, estado_civil, razon_social, ruc,
      representante_legal, email, telefono, direccion, distrito,
      provincia, departamento, notas
    ];
    const DNI = 4, RUC = 8; // posiciones de dni/ruc en params

    // FIX P0-E: dual-write — dni/ruc claros + _hash (siempre) + _enc (si hay clave)
    const key = getPgcryptoKey();
    let piiCols = ', dni_hash, ruc_hash';
    let piiVals = `, ${PII_HASH_SQL(DNI)}, ${PII_HASH_SQL(RUC)}`;
    if (key) {
      const keyP = params.push(key);
      piiCols += ', dni_enc, ruc_enc';
      piiVals += `, ${PII_ENC_SQL(DNI, keyP)}, ${PII_ENC_SQL(RUC, keyP)}`;
    }

    const { rows } = await tenantQuery(
      `INSERT INTO clientes (
         organization_id, tipo_persona, nombre_completo, dni, fecha_nacimiento,
         estado_civil, razon_social, ruc, representante_legal, email, telefono,
         direccion, distrito, provincia, departamento, notas${piiCols})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16${piiVals})
       RETURNING *`,
      params
    );
    // No exponer columnas internas de pseudonimizado/cifrado en la API
    const data = { ...rows[0] };
    delete data.dni_hash; delete data.dni_enc; delete data.ruc_hash; delete data.ruc_enc;
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// PUT /api/clientes/:id - Actualizar
// FIX SQL INJECTION: allowlist de columnas actualizables. NUNCA usar
// Object.keys(req.body) directamente en SQL — un atacante podría
// enviar { "organization_id": X, "eliminado_en": null, ... } y
// tomar control del registro o escapar del tenant.
// Patron dinamico: $$params.length (NUNCA hardcodear $N).
const CLIENTE_UPDATABLE = new Set([
  'tipo_persona', 'nombre_completo', 'dni', 'fecha_nacimiento',
  'estado_civil', 'razon_social', 'ruc', 'representante_legal',
  'email', 'telefono', 'direccion', 'distrito', 'provincia',
  'departamento', 'notas'
]);
router.put('/:id', validate(clienteUpdateSchema), async (req, res, next) => {
  try {
    const fields = Object.keys(req.body).filter(f => CLIENTE_UPDATABLE.has(f));
    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    const params = [];
    const fieldIdx = {};
    let updates = fields.map((f) => {
      params.push(req.body[f]);
      fieldIdx[f] = params.length;
      return `${f} = $${params.length}`;
    }).join(', ');

    // FIX P0-E: dual-write al actualizar dni/ruc — _hash siempre, _enc si hay clave.
    // Si el valor viene null, el CASE deja _hash/_enc en NULL junto con la columna clara.
    const key = getPgcryptoKey();
    let keyP = null;
    if (key) keyP = params.push(key);
    for (const col of ['dni', 'ruc']) {
      const p = fieldIdx[col];
      if (!p) continue;
      updates += `, ${col}_hash = ${PII_HASH_SQL(p)}`;
      if (keyP) updates += `, ${col}_enc = ${PII_ENC_SQL(p, keyP)}`;
    }

    params.push(req.params.id, req.user.organization_id);
    const { rows } = await tenantQuery(
      `UPDATE clientes SET ${updates}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    // No exponer columnas internas de pseudonimizado/cifrado en la API
    const data = { ...rows[0] };
    delete data.dni_hash; delete data.dni_enc; delete data.ruc_hash; delete data.ruc_enc;
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// DELETE /api/clientes/:id - Soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await tenantQuery(
      `UPDATE clientes SET eliminado_en = NOW()
       WHERE id = $1 AND organization_id = $2 AND eliminado_en IS NULL
       RETURNING id`,
      [req.params.id, req.user.organization_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ success: true, message: 'Cliente eliminado' });
  } catch (err) { next(err); }
});

export default router;
