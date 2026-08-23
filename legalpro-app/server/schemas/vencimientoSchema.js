// legalpro-app/server/schemas/vencimientoSchema.js
// Esquema Zod para PATCH /api/plazos/vencimientos/:key
//
// El body permite UNO o AMBOS campos:
//   - nueva_fecha_limite: string ISO YYYY-MM-DD (reagenda por drag & drop)
//   - completado: boolean (marca como completado / reabre)
//
// El :key es la clave compuesta `${expediente_id}::${evento}`
// que produce el frontend (CalendarioVencimientos.jsx).
import { z } from 'zod';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const vencimientoUpdateSchema = z
  .object({
    nueva_fecha_limite: z
      .string()
      .regex(ISO_DATE_RE, 'nueva_fecha_limite debe tener formato YYYY-MM-DD')
      .optional(),
    completado: z.boolean().optional(),
  })
  .refine(
    (data) => data.nueva_fecha_limite !== undefined || data.completado !== undefined,
    {
      message: 'Debe enviar al menos "nueva_fecha_limite" o "completado".',
      path: ['nueva_fecha_limite'],
    }
  )
  // .strict() para rechazar claves desconocidas (defensa contra payload malicioso).
  .strict();

export default vencimientoUpdateSchema;
