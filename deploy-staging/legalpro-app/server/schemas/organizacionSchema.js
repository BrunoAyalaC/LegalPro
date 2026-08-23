import { z } from 'zod';

export const createOrganizacionSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la organización es obligatorio.').max(200),
  plan: z.enum(['BASICO', 'PROFESIONAL', 'EMPRESA']).optional().default('BASICO'),
});
