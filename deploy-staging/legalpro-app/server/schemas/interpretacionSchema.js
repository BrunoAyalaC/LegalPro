// legalpro-app/server/schemas/interpretacionSchema.js
// Zod schema para POST /api/legal/interpret — interpretaciones por rol

import { z } from 'zod';

export const interpretacionSchema = z.object({
  query: z
    .string()
    .min(1, 'La consulta no puede estar vacía.')
    .max(3000, 'La consulta excede el máximo de 3000 caracteres.'),
  respuestasJunior: z
    .array(
      z.object({
        specialty: z.string().min(1, 'specialty requerido'),
        content: z.string().min(1, 'content requerido'),
      })
    )
    .optional()
    .default([]),
  seniorSpecialty: z.string().max(100).optional(),
  rol: z.enum(['abogado', 'fiscal', 'juez', 'completo'], {
    errorMap: () => ({
      message: 'Rol inválido. Debe ser: abogado, fiscal, juez o completo.',
    }),
  }),
});
