import { z } from 'zod';

const dniRegex = /^\d{8}$/;
const rucRegex = /^(10|20)\d{9}$/;

export const clienteCreateSchema = z.object({
  tipo_persona: z.enum(['natural', 'juridica']).default('natural').optional(),
  nombre_completo: z.string().min(2, 'nombre_completo mínimo 2 caracteres').max(200).optional(),
  dni: z.string().regex(dniRegex, 'DNI debe tener exactamente 8 dígitos').optional().nullable(),
  ruc: z.string().regex(rucRegex, 'RUC debe tener 11 dígitos y empezar con 10 o 20').optional().nullable(),
  razon_social: z.string().min(2).max(200).optional().nullable(),
  representante_legal: z.string().min(2).max(200).optional().nullable(),
  email: z.string().email('Email inválido').max(200).optional().nullable(),
  telefono: z.string().min(6).max(20).optional().nullable(),
  direccion: z.string().max(300).optional().nullable(),
  distrito: z.string().max(100).optional().nullable(),
  provincia: z.string().max(100).optional().nullable(),
  departamento: z.string().max(100).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  estado_civil: z.string().max(30).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
}).strict().superRefine((data, ctx) => {
  if (data.tipo_persona === 'natural' && data.dni === undefined && data.nombre_completo === undefined) {
    // permitir parcial pero si se envía dni validar; no obligar aquí - se valida en ruta
  }
  if (data.email === '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Email no puede ser vacío', path: ['email'] });
});

export const clienteUpdateSchema = z.object({
  tipo_persona: z.enum(['natural', 'juridica']).optional(),
  nombre_completo: z.string().min(2).max(200).optional().nullable(),
  dni: z.string().regex(dniRegex, 'DNI debe tener exactamente 8 dígitos').optional().nullable(),
  ruc: z.string().regex(rucRegex, 'RUC debe tener 11 dígitos y empezar con 10 o 20').optional().nullable(),
  razon_social: z.string().min(2).max(200).optional().nullable(),
  representante_legal: z.string().min(2).max(200).optional().nullable(),
  email: z.string().email('Email inválido').max(200).optional().nullable(),
  telefono: z.string().min(6).max(20).optional().nullable(),
  direccion: z.string().max(300).optional().nullable(),
  distrito: z.string().max(100).optional().nullable(),
  provincia: z.string().max(100).optional().nullable(),
  departamento: z.string().max(100).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  estado_civil: z.string().max(30).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
}).strict();
