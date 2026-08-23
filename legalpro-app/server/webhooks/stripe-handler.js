// legalpro-app/server/webhooks/stripe-handler.js
// Generado por @owner-admin (Sprint 4 - Webhook handler)
// Handler de webhooks de Stripe para eventos de billing

import express from 'express';
import crypto from 'node:crypto';

const router = express.Router();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ─── Créditos mensuales incluidos por plan (ADR-005: fuente canónica de créditos) ───
// Al facturar una suscripción (invoice.payment_succeeded) se emite un asiento
// CREDITO tipo_operacion='recarga_mensual' en transacciones_creditos y se
// incrementa organizaciones.creditos_disponibles con esta cantidad.
// La clave es el `lookup_key` del precio de Stripe (mismo valor que se guarda
// en organizaciones.plan en handleSubscriptionCreated).
const CREDITOS_POR_PLAN = {
  free: 150,
  basic: 100,
  pro: 500,
  corp: 1200,
};
// Fallback si el plan comprado no está en el catálogo (no romper el webhook).
const CREDITOS_DEFAULT = 500; // plan 'pro' — lookup_key por defecto del webhook

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  let event;
  try {
    const payload = req.body;
    // Calcular signature esperado
    const expectedSigHex = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // timing-safe comparison — protección contra timing attacks
    const sigBuffer = Buffer.from(sig, 'utf8');
    const expectedBuffer = Buffer.from(expectedSigHex, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      await logAudit('STRIPE_WEBHOOK_INVALID', { ip: req.ip });
      return res.status(401).send('Invalid signature');
    }
    event = JSON.parse(payload.toString('utf8'));
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'charge.refunded':
      await handleRefund(event.data.object);
      break;
    default:
      console.log(`[Stripe] Evento no manejado: ${event.type}`);
  }
  res.json({ received: true });
});

async function handleSubscriptionCreated(subscription) {
  await logAudit('STRIPE_SUBSCRIPTION_CREATED', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    planId: subscription.items.data[0]?.price?.id
  });
  const { db } = await import('../db.js');
  const stripeCustomerId = subscription.customer;
  await db.query(
    `UPDATE organizaciones SET stripe_subscription_id = $1, plan = $2, updated_at = NOW()
     WHERE stripe_customer_id = $3`,
    [subscription.id, subscription.items.data[0]?.price?.lookup_key || 'pro', stripeCustomerId]
  );
}

async function handleSubscriptionUpdated(subscription) {
  await logAudit('STRIPE_SUBSCRIPTION_UPDATED', { subscriptionId: subscription.id });
}

async function handleSubscriptionDeleted(subscription) {
  await logAudit('STRIPE_SUBSCRIPTION_DELETED', { subscriptionId: subscription.id });
  const { db } = await import('../db.js');
  await db.query(
    `UPDATE organizaciones SET plan = 'free', deleted_at = NOW(), updated_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );
}

async function handlePaymentSucceeded(invoice) {
  await logAudit('STRIPE_PAYMENT_SUCCEEDED', {
    invoiceId: invoice.id,
    amountPaid: invoice.amount_paid,
    customerId: invoice.customer
  });

  const { db } = await import('../db.js');
  const stripeCustomerId = invoice.customer;
  const invoiceId = invoice.id;

  // 1. Resolver la organización por stripe_customer_id (misma columna que usa
  //    handleSubscriptionCreated). organizaciones NO tiene RLS → query directo.
  //    También resolvemos el usuario_id (OWNER o primer miembro activo): el
  //    webhook no tiene usuario autenticado y transacciones_creditos.usuario_id
  //    es NOT NULL.
  const { rows: orgRows } = await db.query(
    `SELECT o.id, o.plan, o.creditos_disponibles,
            (SELECT u.id
             FROM usuarios u
             JOIN miembros_organizacion mo ON mo.usuario_id = u.id
             WHERE mo.organizacion_id = o.id AND mo.activo = TRUE
             ORDER BY (mo.rol = 'OWNER') DESC, mo.created_at ASC
             LIMIT 1) AS usuario_id
     FROM organizaciones o
     WHERE o.stripe_customer_id = $1`,
    [stripeCustomerId]
  );
  if (orgRows.length === 0) {
    console.error(`[Stripe] Organización no encontrada para customer ${stripeCustomerId} (invoice ${invoiceId}) — no se acreditan créditos.`);
    return;
  }
  const org = orgRows[0];
  if (!org.usuario_id) {
    console.error(`[Stripe] Organización ${org.id} sin usuarios activos — no se puede emitir asiento CREDITO (usuario_id NOT NULL). Invoice ${invoiceId}.`);
    return;
  }

  // 2. Créditos incluidos en el plan comprado (lookup_key del precio o plan actual).
  const lookupKey = (invoice.lines?.data?.[0]?.price?.lookup_key || org.plan || 'pro').toLowerCase();
  const creditosPlan = CREDITOS_POR_PLAN[lookupKey] ?? CREDITOS_POR_PLAN[org.plan] ?? CREDITOS_DEFAULT;
  const precioPagado = (invoice.amount_paid ?? 0) / 100; // Stripe devuelve centavos → unidades

  // 3. Transacción atómica: idempotencia + asiento CREDITO + incremento de saldo.
  //    transacciones_creditos TIENE RLS (policy p_transacciones_creditos_all:
  //    organization_id = fn_rls_current_org_id()), por lo que activamos el
  //    contexto RLS con SET LOCAL dentro de la transacción (mismo patrón que
  //    server/routes/creditos.js POST /comprar).
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Activar contexto tenant para que las policies RLS apliquen al INSERT/SELECT.
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [org.id]);
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [org.usuario_id]);
    await client.query("SELECT set_config('app.current_user_rol', $1, true)", ['OWNER']);

    // 3.1 Idempotencia: si ya existe asiento CREDITO con esta referencia_externa
    //     (invoice.id), Stripe reintentó el webhook → no duplicar.
    const { rows: yaExiste } = await client.query(
      `SELECT 1 FROM transacciones_creditos
       WHERE referencia_externa = $1 AND tipo_operacion = 'recarga_mensual' AND tipo = 'CREDITO'
       LIMIT 1`,
      [invoiceId]
    );
    if (yaExiste.length > 0) {
      await client.query('COMMIT');
      console.log(`[Stripe] Asiento CREDITO ya existe para invoice ${invoiceId} — idempotencia: no se duplica.`);
      return;
    }

    // 3.2 Incrementar saldo corriente (fuente de verdad de lectura/gatekeeping).
    await client.query(
      `UPDATE organizaciones
       SET creditos_disponibles = creditos_disponibles + $1, updated_at = NOW()
       WHERE id = $2`,
      [creditosPlan, org.id]
    );

    // 3.3 Asiento CREDITO en el ledger inmutable (mismo INSERT que creditos.js).
    const descripcion = `Créditos mensuales incluidos en suscripción ${lookupKey} (invoice ${invoiceId})`;
    await client.query(
      `INSERT INTO transacciones_creditos (
         organization_id, usuario_id, cantidad, tipo, motivo,
         precio_pagado, metodo_pago, estado, descripcion, tipo_operacion, referencia_externa
       )
       VALUES ($1, $2, $3, 'CREDITO', $4, $5, 'stripe', 'aprobado', $6, 'recarga_mensual', $7)`,
      [org.id, org.usuario_id, creditosPlan, descripcion, precioPagado, descripcion, invoiceId]
    );

    await client.query('COMMIT');
    console.log(`[Stripe] Asiento CREDITO emitido: +${creditosPlan} créditos para org ${org.id} (invoice ${invoiceId}, plan ${lookupKey}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Stripe] Error emitiendo asiento CREDITO para invoice ${invoiceId}:`, err.message);
  } finally {
    client.release();
  }
}

async function handlePaymentFailed(invoice) {
  await logAudit('STRIPE_PAYMENT_FAILED', {
    severity: 'HIGH',
    invoiceId: invoice.id,
    customerId: invoice.customer
  });
}

async function handleRefund(charge) {
  await logAudit('STRIPE_REFUND', {
    severity: 'MEDIUM',
    chargeId: charge.id,
    amount: charge.amount_refunded
  });
}

async function logAudit(eventName, payload) {
  try {
    const { db } = await import('../db.js');
    await db.query(
      `INSERT INTO audit_log (tabla, operacion, registro_id, datos_nuevos, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      ['stripe', 'INSERT', eventName, JSON.stringify(payload), payload.ip || null, 'stripe-webhook']
    );
  } catch (e) {
    console.error('[audit] Failed:', e.message);
  }
}

export default router;
