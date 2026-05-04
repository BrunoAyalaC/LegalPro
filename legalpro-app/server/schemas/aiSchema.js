import { z } from 'zod';

export const aiConsultaSchema = z.object({
  mensaje: z.string().min(1, 'El mensaje no puede estar vacío.').max(4000).optional(),
  prompt: z.string().min(1, 'El prompt no puede estar vacío.').max(4000).optional(),
  tipo: z.enum(['general', 'predictor', 'analisis', 'redaccion', 'jurisprudencia', 'alegatos', 'interrogatorio', 'chat']).optional(),
  model: z.string().max(100).optional(),
  disclaimerAceptado: z.boolean().optional(),
}).refine((data) => data.mensaje || data.prompt, {
  message: 'Debe proporcionar al menos "mensaje" o "prompt".',
  path: ['mensaje'],
}).passthrough();
