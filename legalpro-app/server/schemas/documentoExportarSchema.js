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

/**
 * Schema de validación Zod para POST /api/documentos/:id/analizar
 *
 * FIX 2026-08-08 (pipeline visión→cerebro→juniors): nuevo endpoint opcional
 * que ejecuta el pipeline completo de análisis sobre un documento ya subido:
 *   1. Recupera el texto OCR del documento (o del expediente asociado).
 *   2. Llama a `ejecutarHerramienta('analizar_expediente', ...)` con
 *      ocr_metadata para activar el prompt OCR-aware.
 *   3. Devuelve el análisis estructurado (shape canónico v3).
 *
 * Campos:
 *   - materia          : materia legal del análisis (default 'general').
 *   - tipo_analisis    : subtipo ('completo', 'riesgos', 'fortalezas', 'estrategia').
 *   - consulta         : texto libre que el usuario quiere enfocar.
 *   - incluir_rag      : si true, intenta recuperar contexto legal verificado.
 *   - usar_cache_ocr   : si true y existe cache hit, NO se vuelve a procesar.
 */
export const documentoAnalizarSchema = z.object({
  materia: z
    .string()
    .min(2, 'La materia debe tener al menos 2 caracteres.')
    .max(60, 'La materia no puede exceder 60 caracteres.')
    .default('general'),

  tipo_analisis: z
    .enum(['completo', 'riesgos', 'fortalezas', 'estrategia', 'resumen'], {
      errorMap: () => ({ message: 'tipo_analisis debe ser uno de: completo, riesgos, fortalezas, estrategia, resumen.' }),
    })
    .default('completo'),

  consulta: z
    .string()
    .max(2000, 'La consulta no puede exceder 2000 caracteres.')
    .optional()
    .default(''),

  incluir_rag: z
    .boolean()
    .optional()
    .default(true),

  usar_cache_ocr: z
    .boolean()
    .optional()
    .default(true),
}).strict({ message: 'Campos adicionales no permitidos en la solicitud de análisis.' });
