/**
 * horaSchema.js — Validación Zod para Control de Horas (/api/horas).
 * Contrato:
 *   POST /api/horas/registro  { expediente_id, descripcion, minutos, fecha }
 *   GET  /api/horas?mes=YYYY-MM
 *   GET  /api/horas/detalle?mes=YYYY-MM
 *   GET  /api/horas/resumen?anio=YYYY
 */
import { z } from 'zod';

// Mes actual en formato YYYY-MM (evaluado por request, no al cargar el módulo,
// para no quedarnos con el mes viejo si el proceso vive más de un mes).
function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function anioActual() {
  return String(new Date().getFullYear());
}

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const horaRegistroSchema = z.object({
  expediente_id: z.string().uuid('expediente_id debe ser un UUID válido'),
  descripcion: z
    .string()
    .trim()
    .min(3, 'descripcion mínimo 3 caracteres')
    .max(300, 'descripcion máximo 300 caracteres'),
  minutos: z.coerce
    .number({ invalid_type_error: 'minutos debe ser un número entero' })
    .int('minutos debe ser un número entero')
    .min(1, 'minutos debe ser al menos 1')
    .max(1440, 'minutos no puede exceder 1440 (24h)'),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe tener formato YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'fecha inválida'),
}).strict();

export const horasMesQuerySchema = z.object({
  mes: z.string().regex(MES_RE, 'mes debe tener formato YYYY-MM').optional(),
}).transform((d) => ({ mes: d.mes || mesActual() }));

export const horasAnioQuerySchema = z.object({
  anio: z.string().regex(/^\d{4}$/, 'anio debe tener formato YYYY').optional(),
}).transform((d) => ({ anio: d.anio || anioActual() }));
