// legalpro-app/server/routes/creditos.js
// Endpoints reales de créditos — sin mocks, sin setTimeout
// GET  /api/creditos/planes        → lista de paquetes disponibles
// POST /api/creditos/comprar       → comprar paquete con Culqi (token de tarjeta)
// GET  /api/creditos/transacciones → historial del usuario
// GET  /api/creditos/saldo         → créditos disponibles
// GET  /api/creditos/culqi-key     → llave pública de Culqi (para frontend)

import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';
import { createCharge, getPublicKey } from '../adapters/CulqiAdapter.js';

const router = Router();

// ─── PAQUETES DE CRÉDITOS ────────────────────────────────────────────────────
const PLANES_CREDITOS = [
  {
    id: 'plan-basic',
    nombre: 'Paquete Inicial',
    creditos: 100,
    precio: 39,
    popular: false,
    color: 'from-blue-500/20 to-indigo-500/10',
    borderColor: 'border-blue-500/20 hover:border-blue-500/50',
    iconColor: 'text-blue-400',
    glowColor: 'bg-blue-500/10',
  },
  {
    id: 'plan-pro',
    nombre: 'Paquete Profesional',
    creditos: 500,
    precio: 149,
    popular: true,
    color: 'from-indigo-600/30 via-violet-600/25 to-indigo-500/10',
    borderColor: 'border-indigo-500/40 hover:border-indigo-500/70',
    iconColor: 'text-indigo-400',
    glowColor: 'bg-indigo-500/20',
  },
  {
    id: 'plan-corp',
    nombre: 'Paquete Corporativo',
    creditos: 1200,
    precio: 299,
    popular: false,
    color: 'from-purple-500/20 to-pink-500/10',
    borderColor: 'border-purple-500/20 hover:border-purple-500/50',
    iconColor: 'text-purple-400',
    glowColor: 'bg-purple-500/10',
  },
];

// ─── GET /api/creditos/planes ───────────────────────────────────────────────
// Retorna la lista de paquetes de créditos disponibles
router.get('/planes', async (_req, res) => {
  return res.json({ planes: PLANES_CREDITOS });
});

// ─── GET /api/creditos/saldo ────────────────────────────────────────────────
// Retorna los créditos disponibles de la organización autenticada
router.get('/saldo', authMiddleware, tenantMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { rows } = await db.query(
      'SELECT creditos_disponibles FROM organizaciones WHERE id = $1',
      [orgId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Organización no encontrada.' });
    }
    return res.json({ creditos: rows[0].creditos_disponibles });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/creditos/transacciones ────────────────────────────────────────
// Retorna el historial de transacciones de créditos de la organización
router.get('/transacciones', authMiddleware, tenantMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { rows } = await db.query(
      `SELECT id, created_at, cantidad, tipo, motivo AS descripcion, 
              COALESCE(descripcion, motivo, 'Operación') AS detalle
       FROM transacciones_creditos
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [orgId]
    );

    const transacciones = rows.map((tx) => ({
      id: tx.id,
      fecha: tx.created_at ? tx.created_at.toISOString().split('T')[0] : '',
      hora: tx.created_at
        ? tx.created_at.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
        : '',
      tipo: tx.tipo === 'CREDITO' ? 'recarga' : 'consumo',
      descripcion: tx.descripcion || '',
      cantidad: tx.cantidad,
      detalle: tx.detalle || 'Operación',
    }));

    return res.json({ transacciones });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/creditos/culqi-key ────────────────────────────────────────────
// Expone la llave pública de Culqi para que el frontend inicie Culqi.js
router.get('/culqi-key', (_req, res) => {
  try {
    const publicKey = getPublicKey();
    res.json({ publicKey });
  } catch (err) {
    res.status(503).json({ error: 'Culqi no configurado', code: 'CULQI_NO_CONFIGURADO' });
  }
});

// ─── POST /api/creditos/comprar ─────────────────────────────────────────────
// Compra un paquete de créditos: procesa pago con Culqi, luego acredita saldo
router.post('/comprar', authMiddleware, tenantMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const usuarioId = req.user.sub;
    const { planId, culqiToken } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId es requerido.' });
    }

    // Buscar el plan
    const plan = PLANES_CREDITOS.find((p) => p.id === planId);
    if (!plan) {
      return res.status(400).json({ error: `Plan inválido: ${planId}` });
    }

    // Verificar que la organización existe
    const { rows: orgRows } = await db.query(
      'SELECT id FROM organizaciones WHERE id = $1',
      [orgId]
    );
    if (orgRows.length === 0) {
      return res.status(404).json({ error: 'Organización no encontrada.' });
    }

    // Procesar pago con Culqi (si hay token)
    let culqiChargeId = null;
    if (culqiToken && process.env.CULQI_SECRET_KEY) {
      try {
        const montoCentimos = plan.precio * 100; // S/ 39 → 3900 céntimos
        const charge = await createCharge(culqiToken, montoCentimos, `${plan.nombre} - LegalPro`);
        culqiChargeId = charge.id;
        console.log(`[creditos] Pago Culqi exitoso: ${charge.id} - S/${plan.precio}.00`);
      } catch (culqiErr) {
        return res.status(402).json({
          error: 'Error al procesar el pago con Culqi.',
          detalle: culqiErr.merchant_message || culqiErr.message,
          code: 'CULQI_RECHAZADO',
        });
      }
    } else if (process.env.CULQI_SECRET_KEY) {
      return res.status(400).json({ error: 'Token de Culqi requerido para procesar el pago.' });
    } else {
      console.log('[creditos] Culqi no configurado — modo desarrollo (sin pago real)');
    }

    // Transacción atómica: actualizar saldo + registrar transacción
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Actualizar créditos disponibles (sumar)
      await client.query(
        'UPDATE organizaciones SET creditos_disponibles = creditos_disponibles + $1 WHERE id = $2',
        [plan.creditos, orgId]
      );

      // Registrar la transacción (CREDITO = recarga)
      const descripcion = `Compra de ${plan.nombre}${culqiChargeId ? ' (Pagado con Culqi)' : ''}`;
      const { rows: txRows } = await client.query(
        `INSERT INTO transacciones_creditos (
           organization_id, usuario_id, cantidad, tipo, motivo,
           precio_pagado, metodo_pago, estado, descripcion, tipo_operacion,
           referencia_externa
         )
         VALUES ($1, $2, $3, 'CREDITO', $4, $5, 'culqi', 'aprobado', $6, 'recarga', $7)
         RETURNING id, created_at`,
        [
          orgId,
          usuarioId,
          plan.creditos,
          descripcion,
          plan.precio,
          descripcion,
          culqiChargeId, // referencia_externa = ID del cargo en Culqi
        ]
      );

      // Obtener el nuevo saldo
      const { rows: saldoRows } = await client.query(
        'SELECT creditos_disponibles FROM organizaciones WHERE id = $1',
        [orgId]
      );

      await client.query('COMMIT');

      return res.json({
        exito: true,
        creditosRestantes: saldoRows[0].creditos_disponibles,
        creditosAgregados: plan.creditos,
        transaccion: {
          id: txRows[0].id,
          fecha: txRows[0].created_at,
          tipo: 'recarga',
          descripcion: descripcion,
          cantidad: plan.creditos,
          detalle: 'Recarga de Saldo',
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
