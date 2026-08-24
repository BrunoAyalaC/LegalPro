import { z } from 'zod';

export const expedienteQuerySchema = z.object({
  estado: z.string().max(30).optional(),
  tipo: z.string().max(30).optional(),
  urgente: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export const expedienteCreateSchema = z.object({
  numero: z.string().min(1).max(50),
  titulo: z.string().min(1).max(300),
  tipo: z.enum(['civil', 'penal', 'laboral', 'constitucional', 'familia', 'administrativo']),
  juzgado: z.string().max(200).optional().nullable(),
  esUrgente: z.boolean().optional().default(false),
}).strict();

export const expedienteUpdateSchema = z.object({
  titulo: z.string().min(2).max(300).optional(),
  estado: z.enum(['activo', 'archivado', 'cerrado', 'suspendido', 'en_tramite', 'apelacion', 'resuelto']).optional(),
  juzgado: z.string().max(200).optional().nullable(),
  tipo: z.enum(['civil', 'penal', 'laboral', 'constitucional', 'familia', 'administrativo']).optional(),
  esUrgente: z.boolean().optional(),
  // FIX anti-mock A (2026-08-24): resultado real del caso (alimenta KPI tasa_exito).
  resultado: z.enum(['favorable', 'desfavorable']).nullable().optional(),
}).strict();
