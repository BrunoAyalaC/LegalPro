// legalpro-app/server/webhooks/stripe-handler.js
// Generado por @owner-admin (Sprint 4 - Webhook handler)
// Handler de webhooks de Stripe para eventos de billing

import express from 'express';
import crypto from 'node:crypto';

const router = express.Router();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  let event;
  try {
    const payload = req.body;
    const expectedSig = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    if (sig !== expectedSig) {
      await logAudit('STRIPE_WEBHOOK_INVALID', { sig, ip: req.ip });
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
      `INSERT INTO audit_log (event_name, severity, payload_masked, ip_address, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [eventName, payload.severity || 'INFO', JSON.stringify(payload), payload.ip || null]
    );
  } catch (e) {
    console.error('[audit] Failed:', e.message);
  }
}

export default router;
