/**
 * Schema de validación Zod para los endpoints de generación de documentos
 * desde el chat:
 *
 *   POST /api/ai/detectar-documento → detectarDocumentoSchema
 *   POST /api/ai/redactar-documento → redactarDocumentoSchema
 *
 * Reutiliza el mismo catálogo de tipos que documentoExportarSchema.js para
 * mantener coherencia con /api/documentos/exportar.
 */
import { z } from 'zod';

/** Tipos de documentos legales soportados (mismo catálogo que el exportador) */
export const TIPOS_DOCUMENTO = Object.freeze([
  'demanda',
  'contestacion',
  'apelacion',
  'casacion',
  'amparo',
  'habeas_corpus',
  'escrito_simple',
  'alegato',
  'denuncia',
  'contrato',
  'dictamen',
  'pericial',
  'medida_cautelar',
  'resumen',
  'custodia',
]);

/** Formatos de exportación soportados */
export const FORMATOS_EXPORTACION = Object.freeze(['pdf', 'docx']);

/**
 * Mensaje de conversación. El frontend puede enviar cualquiera de estas formas:
 *   { rol, contenido } | { rol, mensaje } | { role, text } | "texto plano"
 */
const mensajeConversacionSchema = z
  .object({
    rol: z.string().max(50).optional(),
    role: z.string().max(50).optional(),
    contenido: z.string().max(8000).optional(),
    mensaje: z.string().max(8000).optional(),
    text: z.string().max(8000).optional(),
    content: z.string().max(8000).optional(),
  })
  .refine((m) => m.contenido || m.mensaje || m.text || m.content, {
    message: 'Cada mensaje debe contener "contenido", "mensaje", "text" o "content".',
    path: ['contenido'],
  });

const conversacionSchema = z
  .array(mensajeConversacionSchema)
  .min(1, 'Se requiere al menos un mensaje en la conversación.')
  .max(100, 'La conversación no puede exceder 100 mensajes.');

export const detectarDocumentoSchema = z
  .object({
    conversacion: conversacionSchema,
    materia: z.string().max(100).optional(),
    expediente_id: z.string().max(100).optional(),
    disclaimerAceptado: z.boolean().optional(),
  })
  .passthrough();

export const redactarDocumentoSchema = z
  .object({
    conversacion: conversacionSchema,
    tipo_documento: z.enum(TIPOS_DOCUMENTO, {
      errorMap: () => ({
        message: `Tipo de documento inválido. Valores permitidos: ${TIPOS_DOCUMENTO.join(', ')}`,
      }),
    }),
    materia: z.string().max(100).optional(),
    numero_expediente: z.string().max(50).optional(),
    formato: z
      .enum(FORMATOS_EXPORTACION, {
        errorMap: () => ({
          message: `Formato inválido. Valores permitidos: ${FORMATOS_EXPORTACION.join(', ')}`,
        }),
      })
      .default('pdf'),
    /** Metadatos opcionales para el membrete (iguales a /api/documentos/exportar) */
    juzgado: z.string().max(200).optional(),
    recurrente: z.string().max(200).optional(),
    abogado: z.string().max(200).optional(),
    colegiatura: z.string().max(30).optional(),
    organizacion: z.string().max(200).optional(),
    disclaimerAceptado: z.boolean().optional(),
  })
  .passthrough();
