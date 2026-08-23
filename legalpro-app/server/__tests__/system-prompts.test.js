/**
 * systemPrompts.js — Tests del módulo de prompts maestros reutilizables.
 *
 * Cubre:
 *  - buildMasterPrompt: composición de bloques según flags de contexto.
 *  - buildPromptAnalisis / buildPromptPredictor / buildPromptRouter: presets.
 *  - buildSystemPrompt: helper con instrucciones de rol.
 *  - Bloques exportados: integridad de las constantes.
 *  - Fail-open: args inválidos NO rompen el compositedor.
 *
 * SKILL: enrutamiento-intenciones-chat v1.2.0
 * @author BackendNode
 */
import { describe, test, expect } from 'vitest';
import {
  buildMasterPrompt,
  buildSystemPrompt,
  buildPromptAnalisis,
  buildPromptPredictor,
  buildPromptRouter,
  BLOQUE_ROL,
  BLOQUE_MATERIA,
  BLOQUE_OCR_AWARE,
  BLOQUE_RAG,
  BLOQUE_LOPD,
  BLOQUE_FORMATO,
  BLOQUE_CITAS_LEGALES,
  BLOQUE_VELOCIDAD,
} from '../utils/systemPrompts.js';

describe('buildMasterPrompt — composición base', () => {
  test('devuelve string no vacío con args vacíos (defaults)', () => {
    const p = buildMasterPrompt();
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(100);
    // Bloque base OBLIGATORIO de idioma es-PE.
    expect(p).toMatch(/español del Perú/i);
  });

  test('aplica ROL ABOGADO cuando se pasa', () => {
    const p = buildMasterPrompt({ rol: 'ABOGADO' });
    expect(p).toMatch(/abogado colegiado peruano/i);
    expect(p).toMatch(/\[ROL\]/);
  });

  test('aplica ROL FISCAL/JUEZ/CONTADOR/USUARIO según argumento', () => {
    expect(buildMasterPrompt({ rol: 'FISCAL' })).toMatch(/fiscal peruano/i);
    expect(buildMasterPrompt({ rol: 'JUEZ' })).toMatch(/magistrado peruano/i);
    expect(buildMasterPrompt({ rol: 'CONTADOR' })).toMatch(/contador peruano/i);
  });

  test('tolera ROL desconocido y degrada a USUARIO', () => {
    const p = buildMasterPrompt({ rol: 'INVENTADO' });
    expect(p).toMatch(/asistente jurídico general/i);
  });
});

describe('buildMasterPrompt — materia', () => {
  test('incluye bloque MATERIA solo si la materia es soportada', () => {
    const p = buildMasterPrompt({ materia: 'civil' });
    expect(p).toMatch(/\[MATERIA: CIVIL\]/);
    expect(p).toMatch(/DERECHO CIVIL peruano/i);
  });

  test('ignora materia no soportada (null/desconocida)', () => {
    const p = buildMasterPrompt({ materia: 'desconocida' });
    expect(p).not.toMatch(/\[MATERIA:/);
  });

  test.each(['penal', 'civil', 'laboral', 'constitucional', 'comercial', 'tributario', 'administrativo', 'familia'])(
    'materia soportada: %s',
    (materia) => {
      const p = buildMasterPrompt({ materia });
      expect(p).toMatch(new RegExp(`MATERIA: ${materia.toUpperCase()}`));
    }
  );
});

describe('buildMasterPrompt — contexto (OCR/RAG/LOPD)', () => {
  test('incluye OCR-AWARE solo si context.ocr_aware=true', () => {
    expect(buildMasterPrompt({ context: { ocr_aware: true } })).toMatch(/OCR-AWARE|transcripción automática/i);
    expect(buildMasterPrompt({ context: { ocr_aware: false } })).not.toMatch(/\[OCR-AWARE\]/);
  });

  test('incluye RAG solo si context.rag_aware=true', () => {
    expect(buildMasterPrompt({ context: { rag_aware: true } })).toMatch(/\[RAG\]/);
    expect(buildMasterPrompt({ context: { rag_aware: false } })).not.toMatch(/\[RAG\]/);
  });

  test('incluye LOPD solo si context.lpdp_aware=true', () => {
    expect(buildMasterPrompt({ context: { lpdp_aware: true } })).toMatch(/\[LOPD\]|29733/i);
    expect(buildMasterPrompt({ context: { lpdp_aware: false } })).not.toMatch(/\[LOPD\]/);
  });
});

describe('buildMasterPrompt — velocidad y formato', () => {
  test('incluye VELOCIDAD cuando preferencias.velocidad=rapida', () => {
    expect(buildMasterPrompt({ preferencias: { velocidad: 'rapida' } })).toMatch(/\[VELOCIDAD\]/);
  });

  test('incluye VELOCIDAD cuando context.formato=corto', () => {
    expect(buildMasterPrompt({ context: { formato: 'corto' } })).toMatch(/\[VELOCIDAD\]/);
  });

  test('NO incluye VELOCIDAD con formato=medio/extenso y velocidad normal', () => {
    expect(buildMasterPrompt({ context: { formato: 'medio' }, preferencias: { velocidad: 'normal' } })).not.toMatch(/\[VELOCIDAD\]/);
    expect(buildMasterPrompt({ context: { formato: 'extenso' } })).not.toMatch(/\[VELOCIDAD\]/);
  });
});

describe('buildMasterPrompt — restricciones y fail-open', () => {
  test('concatena restricciones al final', () => {
    const p = buildMasterPrompt({ restricciones: ['No citar X', 'Citar siempre TC'] });
    expect(p).toMatch(/\[RESTRICCIONES ADICIONALES\]/);
    expect(p).toMatch(/- No citar X/);
    expect(p).toMatch(/- Citar siempre TC/);
  });

  test('ignora restricciones vacías o no-string', () => {
    const p = buildMasterPrompt({ restricciones: ['', null, 123, '   '] });
    expect(p).not.toMatch(/\[RESTRICCIONES ADICIONALES\]/);
  });

  test('fail-open: args inválidos NO lanzan y degradan a defaults', () => {
    expect(() => buildMasterPrompt({ rol: null, materia: undefined, context: 'no-objeto', preferencias: 7 })).not.toThrow();
    const p = buildMasterPrompt({ rol: null, materia: undefined });
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(0);
  });
});

describe('Presets: buildPromptAnalisis / buildPromptPredictor / buildPromptRouter', () => {
  test('buildPromptAnalisis incluye OCR-AWARE + RAG + LOPD por defecto', () => {
    const p = buildPromptAnalisis();
    expect(p).toMatch(/\[OCR-AWARE\]|transcripción automática/i);
    expect(p).toMatch(/\[RAG\]/);
    expect(p).toMatch(/\[LOPD\]|29733/i);
  });

  test('buildPromptAnalisis respeta ocr_aware=false explícito', () => {
    const p = buildPromptAnalisis({ ocr_aware: false });
    expect(p).not.toMatch(/\[OCR-AWARE\]/);
  });

  test('buildPromptPredictor incluye disclaimer y RAG (sin OCR)', () => {
    const p = buildPromptPredictor();
    expect(p).toMatch(/requiere_revision_humana = true/);
    expect(p).toMatch(/\[RAG\]/);
    expect(p).not.toMatch(/\[OCR-AWARE\]/);
  });

  test('buildPromptRouter incluye instrucciones del router + velocidad rápida', () => {
    const p = buildPromptRouter();
    expect(p).toMatch(/Router de Intenciones/i);
    expect(p).toMatch(/\[VELOCIDAD\]/);
  });
});

describe('buildSystemPrompt — helper con instrucciones de rol', () => {
  test('concatena instrucciones personalizadas + master prompt + base', () => {
    const p = buildSystemPrompt('Eres un asistente personalizado.', { rol: 'FISCAL' });
    expect(p).toMatch(/asistente personalizado/i);
    expect(p).toMatch(/fiscal peruano/i);
    expect(p).toMatch(/español del Perú/i);
  });

  test('funciona sin instrucciones de rol (string vacío)', () => {
    const p = buildSystemPrompt('', { rol: 'ABOGADO' });
    expect(p).toMatch(/abogado colegiado/i);
  });
});

describe('Bloques exportados — integridad', () => {
  test('BLOQUE_ROL: 5 roles (ABOGADO, FISCAL, JUEZ, CONTADOR, USUARIO)', () => {
    expect(Object.keys(BLOQUE_ROL).sort()).toEqual(['ABOGADO', 'CONTADOR', 'FISCAL', 'JUEZ', 'USUARIO']);
    Object.values(BLOQUE_ROL).forEach((v) => expect(typeof v).toBe('string'));
  });

  test('BLOQUE_MATERIA: incluye civil, penal, laboral, constitucional', () => {
    expect(BLOQUE_MATERIA.civil).toBeTruthy();
    expect(BLOQUE_MATERIA.penal).toBeTruthy();
    expect(BLOQUE_MATERIA.laboral).toBeTruthy();
    expect(BLOQUE_MATERIA.constitucional).toBeTruthy();
  });

  test('BLOQUE_OCR_AWARE, BLOQUE_RAG, BLOQUE_LOPD, BLOQUE_FORMATO, BLOQUE_CITAS_LEGALES, BLOQUE_VELOCIDAD son strings no vacíos', () => {
    [BLOQUE_OCR_AWARE, BLOQUE_RAG, BLOQUE_LOPD, BLOQUE_FORMATO, BLOQUE_CITAS_LEGALES, BLOQUE_VELOCIDAD].forEach((b) => {
      expect(typeof b).toBe('string');
      expect(b.length).toBeGreaterThan(50);
    });
  });

  test('BLOQUE_LOPD menciona la Ley 29733', () => {
    expect(BLOQUE_LOPD).toMatch(/29733/);
  });

  test('BLOQUE_CITAS_LEGALES tiene regla anti-alucinación explícita', () => {
    expect(BLOQUE_CITAS_LEGALES).toMatch(/NUNCA inventes/i);
  });
});