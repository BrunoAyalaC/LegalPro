# ADR-005: Fuente canónica de créditos (saldo corriente + ledger inmutable)

- **Estado:** Aprobado (ArquitectoChief)
- **Fecha:** 2026-08-07
- **Stacks afectados:** Backend Node (legalpro-app/server), BD PostgreSQL/Supabase
- **Actores:** ArquitectoChief, BackendNode, Database, GobernanzaChief, ProductOwner
- **Relacionado:** ADR-001, catálogo `role-tools.json`

## Contexto

Existen 4 fuentes de "créditos" superpuestas en producción:

1. `organizaciones.creditos_disponibles` — saldo corriente (usado por `TokenRepository.verificarCreditos`/`debitarCreditos` y endpoints `/saldo`, `/uso`).
2. `transacciones_creditos` — ledger de movimientos (DEBITO/CREDITO, cantidad, motivo, precio_pagado, metodo_pago, estado, tipo_operacion, referencia_externa).
3. `consumo_tokens_ia` — consumo técnico de tokens (prompt/completion tokens, costo_usd, idempotency_key UNIQUE).
4. `suscripciones` — planes/pagos (vacía en producción: 0 filas).

El backend verifica saldo **siempre** contra `organizaciones.creditos_disponibles` antes de cada llamada IA. Los débitos registran asiento DEBITO en `transacciones_creditos` en la misma transacción (SELECT FOR UPDATE + UPDATE + INSERT). El consumo de tokens se registra en `consumo_tokens_ia` **sin** vínculo contable con el saldo. El modelo de negocio real es **crédito por operación** (1 fijo en chat/consulta, 3 en Panel de Expertos), no costo por tokens (costo_usd acumulado ≈ $0.0074/mes).

## Decisión

- **Fuente de verdad del saldo (lectura y gatekeeping):** `organizaciones.creditos_disponibles` como saldo corriente materializado (con `FOR UPDATE` en escrituras, como hoy).
- **Fuente de verdad contable:** `transacciones_creditos` como **ledger inmutable append-only** (patrón cuenta-contable). Todo movimiento de saldo (recarga, débito, apertura, ajuste, suscripción) DEBE tener su asiento.
- **`consumo_tokens_ia`:** detalle técnico NO contable (métricas, costo MiniMax, idempotencia). No debita saldo por sí mismo; el débito lo hace explícitamente `debitarCreditos`.
- **`suscripciones`:** contrato de plan, NO saldo. Al facturar/activar, se emite asiento CREDITO `tipo_operacion='recarga_mensual'` con `referencia_externa` = id de suscripción/invoice.
- **Invariante de reconciliación:** `creditos_disponibles = saldo_inicial_apertura + Σ(CREDITO) - Σ(DEBITO)`.

## Alternativas consideradas

1. **Calcular saldo on-the-fly sumando el ledger** — rechazada: agrega latencia en hot path (verificarCreditos por request IA) y complica el gatekeeping con RLS.
2. **`consumo_tokens_ia` como fuente de verdad** — rechazada: es técnico/costos, no refleja recargas ni el modelo por-operación.
3. **Mantener columnas legacy (`max_consultas_ia`, `consultas_ia_usadas`, `creditos_ia_extra`, `reset_ia_date`)** — rechazada: son redundantes/paralelas y no se usan en código; se deprecan.

## Consecuencias

- **Positivas:** única lectura de saldo (rápida, RLS), ledger auditable e inmutable, trazabilidad de suscripción→crédito, alineado a auditoría LPDP (movimientos de valor auditables).
- **Negativas / pendientes:**
  1. El ledger actual NO cuadra con el saldo columna (demo: columna 4976 vs ledger -22). Requiere **backfill de asientos de apertura** por organización.
  2. `interpretacion-legal.js` registra consumo sin debitar → posible fuga de créditos; debe pasar por `debitarCreditos`.
  3. Stripe (`handlePaymentSucceeded`) no acredita créditos → la tabla `suscripciones` queda huérfana; debe emitir asiento CREDITO.
  4. Sin job de reconciliación hoy: se agrega `reconciliarCreditos` (cron diario + verificación bajo demanda).
  5. No hay idempotencia en asientos de recarga: se añade UNIQUE(referencia_externa, tipo_operacion) para CREDITO.

## Sign-off

- **ArquitectoChief:** Aprobado (decisión técnica).
- **GobernanzaChief:** Pendiente para backfill de datos personales asociados (LPDP).
- **ProductOwner:** Pendiente validación de que "créditos incluidos en suscripción" se acrediten al activar plan.
