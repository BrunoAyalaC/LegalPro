/**
 * Schema de validación Zod para POST /api/boveda/guardar-documento
 *
 * Valida el payload que llega desde el Chat IA para guardar un documento
 * generado (PDF/DOCX) en la Bóveda de Evidencia del expediente.
 *
 * La Bóveda exige SHA-256 + cadena de custodia (Ley 27269). El contenido
 * viaja en base64; el hash se calcula sobre el buffer decodificado en la ruta.
 */
import { z } from 'zod';

/** Tipos MIME admitidos por la Bóveda (documentos legales generados por IA) */
const MIME_TYPES = Object.freeze([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/rtf',
  'text/plain',
  'text/markdown',
]);

/**
 * Valida que la cadena tenga forma de base64 estándar.
 * La decodificación y verificación de tamaño real ocurren en el handler
 * (express.json ya limita el body a 1MB).
 */
const BASE64_RE = /^[A-Za-z0-9+/=\r\n\s]*$/;

export const bovedaChatSchema = z.object({
  /** UUID del expediente al que se vincula la evidencia (pertenencia validada contra el JWT) */
  expediente_id: z
    .uuid('expediente_id debe ser un UUID válido.'),

  /** Nombre del documento generado (visible en la Bóveda) */
  nombre: z
    .string()
    .min(1, 'El nombre no puede estar vacío.')
    .max(255, 'El nombre no puede exceder 255 caracteres.')
    .default('Documento generado'),

  /** Descripción opcional del documento/evidencia */
  descripcion: z
    .string()
    .max(1000, 'La descripción no puede exceder 1000 caracteres.')
    .optional(),

  /** Contenido binario del documento en base64 (origen: exportación IA PDF/DOCX) */
  contenido_base64: z
    .string()
    .min(1, 'contenido_base64 es requerido.')
    .max(3_000_000, 'contenido_base64 excede el tamaño máximo permitido (≈2MB de documento).')
    .refine((v) => BASE64_RE.test(v), {
      message: 'contenido_base64 contiene caracteres que no son base64 válido.',
    }),

  /** Tipo MIME del documento. Default: PDF (formato judicial peruano) */
  mime_type: z
    .enum(MIME_TYPES, {
      errorMap: () => ({
        message: `mime_type inválido. Valores permitidos: ${MIME_TYPES.join(', ')}`,
      }),
    })
    .default('application/pdf'),
}).strict({ message: 'Campos adicionales no permitidos en la solicitud.' });
