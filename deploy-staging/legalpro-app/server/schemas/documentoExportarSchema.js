/**
 * Schema de validación Zod para POST /api/documentos/exportar
 *
 * Valida los campos del documento legal peruano antes de exportar.
 * Cumple con el formato judicial peruano según las reglas del PJ.
 */
import { z } from 'zod';

/** Tipos de documentos legales soportados */
const TIPOS_DOCUMENTO = Object.freeze([
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
const FORMATOS_EXPORTACION = Object.freeze(['docx', 'pdf']);

export const documentoExportarSchema = z.object({
  /** Tipo de documento legal peruano */
  tipo: z
    .enum(TIPOS_DOCUMENTO, {
      errorMap: () => ({
        message: `Tipo de documento inválido. Valores permitidos: ${TIPOS_DOCUMENTO.join(', ')}`,
      }),
    }),

  /** Juzgado o autoridad a la que se dirige */
  juzgado: z
    .string()
    .min(3, 'El nombre del juzgado debe tener al menos 3 caracteres.')
    .max(200, 'El nombre del juzgado no puede exceder 200 caracteres.'),

  /** Número de expediente judicial */
  numeroExpediente: z
    .string()
    .min(3, 'El número de expediente debe tener al menos 3 caracteres.')
    .max(50, 'El número de expediente no puede exceder 50 caracteres.'),

  /** Sumilla o resumen del pedido */
  sumilla: z
    .string()
    .min(5, 'La sumilla debe tener al menos 5 caracteres.')
    .max(500, 'La sumilla no puede exceder 500 caracteres.'),

  /** Contenido completo del documento en texto plano o HTML básico */
  contenido: z
    .string()
    .min(10, 'El contenido debe tener al menos 10 caracteres.')
    .max(100000, 'El contenido no puede exceder 100,000 caracteres.'),

  /** Nombre del recurrente / demandante / solicitante */
  recurrente: z
    .string()
    .min(3, 'El nombre del recurrente debe tener al menos 3 caracteres.')
    .max(200, 'El nombre del recurrente no puede exceder 200 caracteres.'),

  /** Nombre del abogado patrocinante */
  abogado: z
    .string()
    .min(3, 'El nombre del abogado debe tener al menos 3 caracteres.')
    .max(200, 'El nombre del abogado no puede exceder 200 caracteres.'),

  /** Formato de exportación: docx (Word) o pdf */
  formato: z
    .enum(FORMATOS_EXPORTACION, {
      errorMap: () => ({
        message: `Formato inválido. Valores permitidos: ${FORMATOS_EXPORTACION.join(', ')}`,
      }),
    }),

  /** Número de colegiatura del abogado (opcional) */
  colegiatura: z
    .string()
    .max(30, 'La colegiatura no puede exceder 30 caracteres.')
    .optional(),

  /** Nombre de la organización / estudio jurídico (opcional) */
  organizacion: z
    .string()
    .max(200, 'El nombre de la organización no puede exceder 200 caracteres.')
    .optional(),
}).strict({ message: 'Campos adicionales no permitidos en la solicitud.' });
