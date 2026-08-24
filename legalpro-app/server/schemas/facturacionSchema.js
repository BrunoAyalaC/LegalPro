/**
 * facturacionSchema.js — Validación Zod para Facturación de Honorarios (/api/facturacion).
 * Contrato:
 *   POST  /api/facturacion            { cliente_nombre, cliente_ruc?, concepto, monto_base, expediente_id? }
 *   PATCH /api/facturacion/:id/estado { estado: 'emitido'|'pagado'|'anulado' }
 *
 * Notas:
 *   - RUC peruano: 11 dígitos iniciando en 10 (persona natural) o 20 (jurídica),
 *     según padrón SUNAT. Se valida formato, NO dígito verificador (alcance MVP).
 *   - IGV 18% se calcula en el ROUTER (server/routes/facturacion.js), no aquí:
 *     el schema valida entrada, nunca aplica reglas de negocio tributaria.
 */
import { z } from 'zod';

export const RUC_RE = /^(10|20)\d{9}$/;

/** '' | null → undefined (campos opcionales que llegan vacíos desde el form FE).
 *  El .optional() va DENTRO del pipe: en Zod 4 un ZodPipe externo con
 *  .optional() NO corta-circuito antes de ejecutar el preprocess. */
const emptyToUndefined = (schema) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    schema.optional(),
  );

export const reciboCreateSchema = z
  .object({
    cliente_nombre: z
      .string({ message: 'cliente_nombre debe ser texto' })
      .trim()
      .min(3, 'cliente_nombre mínimo 3 caracteres')
      .max(200, 'cliente_nombre máximo 200 caracteres'),
    cliente_ruc: emptyToUndefined(
      z
        .string()
        .trim()
        .regex(RUC_RE, 'RUC inválido: 11 dígitos iniciando en 10 o 20'),
    ),
    concepto: z
      .string({ message: 'concepto debe ser texto' })
      .trim()
      .min(5, 'concepto mínimo 5 caracteres')
      .max(500, 'concepto máximo 500 caracteres'),
    monto_base: z.coerce
      .number({ message: 'monto_base debe ser un número' })
      .min(1, 'monto_base mínimo S/ 1.00')
      .max(1_000_000, 'monto_base máximo S/ 1,000,000.00')
      // Normalizar a 2 decimales (evita 0.1+0.2 float drift en NUMERIC(12,2))
      .transform((v) => Math.round(v * 100) / 100),
    expediente_id: emptyToUndefined(
      z.string().uuid('expediente_id debe ser un UUID válido'),
    ),
  })
  .strict();

export const reciboEstadoSchema = z
  .object({
    estado: z.enum(['emitido', 'pagado', 'anulado'], {
      message: "estado debe ser 'emitido', 'pagado' o 'anulado'",
    }),
  })
  .strict();
