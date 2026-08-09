/**
 * Router de Intenciones del Chat — Tests
 *
 * Cubre:
 *  - FASE 0 (detectarIntencionFase0) con el eval-set de casos del skill
 *  - resolverPlazoId (acto_procesal → plazo_id del catálogo)
 *  - providerRouter.mapToolChoice multi-función (AUTO / ANY / NONE)
 *  - providerRouter.normalizeResponse con MULTIPLES tool_calls
 *  - data estructurada por tool (v3): shapes canónicos de calcular_plazo,
 *    redactar_documento y el retorno de enrutarMensaje (contrato estable).
 *
 * SKILL: enrutamiento-intenciones-chat
 * @author BackendNode
 */
import { describe, test, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { detectarIntencionFase0, resolverPlazoId } from '../utils/intentFase0.js';
import { mapToolChoice, normalizeResponse } from '../utils/providerRouter.js';
import { ejecutarHerramienta, enrutarMensaje, tipoRespuestaDeIntent } from '../utils/intentRouter.js';

// Mock del servicio redactor: el test de redactar_documento NO debe llamar al
// proveedor IA real (determinismo en CI/local sin API key).
vi.mock('../services/documentoRedactor.js', () => ({
  redactarDocumento: vi.fn(async () => ({
    sumilla: 'SUMILLA DE PRUEBA',
    fundamentos: ['Fundamento 1 con cita legal'],
    petitorio: 'PETITORIO DE PRUEBA',
    base_legal: ['Art. X de la Ley Y'],
    otrosi_primero: '',
    otrosi_segundo: '',
    tokens: 12,
    provider: 'test',
    model: 'test-model',
  })),
}));

const catalog = JSON.parse(readFileSync(new URL('../../../catalogs/plazos-procesales.json', import.meta.url), 'utf-8'));

describe('FASE 0 — detectarIntencionFase0', () => {
  const casos = [
    ['Redacta una demanda de alimentos', 'redactar_documento'],
    ['Necesito un escrito de apelación', 'redactar_documento'],
    ['Elabora una casación civil', 'redactar_documento'],
    ['¿Cuándo vence el plazo para apelar?', 'calcular_plazo'],
    ['¿Cuántos días hábiles tengo para contestar?', 'calcular_plazo'],
    ['¿Cae en feriado?', 'calcular_plazo'],
    ['Analiza el expediente 2026-001', 'analizar_expediente'],
    ['¿Qué riesgos tiene mi caso?', 'analizar_expediente'],
    ['Busca jurisprudencia sobre desalojo', 'buscar_jurisprudencia'],
    ['Precedentes del TC sobre habeas corpus', 'buscar_jurisprudencia'],
    ['Casaciones sobre despido arbitrario', 'buscar_jurisprudencia'],
    ['¿Qué probabilidad tengo de ganar?', 'predecir_resultado'],
    ['Predice el resultado del expediente X', 'predecir_resultado'],
    ['¿Vamos a ganar la demanda?', 'predecir_resultado'],
    // Conflictos: verbo específico / prioridad ordinal del skill
    ['redacta que plazo vence para apelar', 'calcular_plazo'],
    ['busca jurisprudencia sobre la demanda que debo redactar', 'buscar_jurisprudencia'],
    // Sin intención → FASE 1 (null)
    ['Hola', null],
    ['Gracias', null],
    ['¿Qué dice el artículo 144 CPC?', null],
  ];

  test.each(casos)('detecta "%s" → %s', (frase, esperado) => {
    const r = detectarIntencionFase0(frase);
    expect(r ? r.intent : null).toBe(esperado);
  });

  test('infiere args básicos (tipo_documento) en redactar_documento', () => {
    const r = detectarIntencionFase0('Redacta una demanda de alimentos');
    expect(r.intent).toBe('redactar_documento');
    expect(r.args.tipo_documento).toBe('demanda');
    expect(r.args.hechos).toContain('alimentos');
  });

  test('extrae UUID de expediente en analizar_expediente', () => {
    const r = detectarIntencionFase0('Analiza el expediente 123e4567-e89b-12d3-a456-426614174000');
    expect(r.intent).toBe('analizar_expediente');
    expect(r.args.expediente_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(r.args.tipo_analisis).toBe('completo');
  });

  test('detecta tipo_analisis=riesgos', () => {
    const r = detectarIntencionFase0('¿Qué riesgos tiene mi expediente?');
    expect(r.intent).toBe('analizar_expediente');
    expect(r.args.tipo_analisis).toBe('riesgos');
  });

  test('devuelve null para texto vacío o no string', () => {
    expect(detectarIntencionFase0('')).toBeNull();
    expect(detectarIntencionFase0(null)).toBeNull();
    expect(detectarIntencionFase0(undefined)).toBeNull();
  });
});

describe('resolverPlazoId — acto_procesal → plazo_id', () => {
  const casos = [
    ['apelar la sentencia civil', 'plazo_apelacion_sentencia_civil'],
    ['contestar demanda laboral', 'plazo_contestacion_laboral'],
    ['plazo para presentar casación civil', 'plazo_casacion_civil'],
    ['investigación preparatoria', 'plazo_investigacion_preparatoria'],
    // SKILL: enrutamiento-intenciones-chat v1.1.0 — fix bug P0 (auditor-legal
    // 2026-08-08): preguntas tipo "demandar contencioso-administrativo" antes
    // empataban a 3 plazos (mismo stem "conte"+"deman") y devolvía el primero
    // del catálogo (plazo_contestacion_demanda_civil). Ahora el desempate por
    // prefijo común más largo favorece al plazo correcto.
    ['demandar contencioso-administrativo', 'plazo_contencioso_administrativo'],
    ['demanda contencioso-administrativa', 'plazo_contencioso_administrativo'],
    ['Cuánto tiempo tengo para demandar contencioso-administrativo?', 'plazo_contencioso_administrativo'],
    ['prescripción penal', 'plazo_prescripcion_penal'],
    ['prescripción civil', 'plazo_prescripcion_civil'],
  ];

  test.each(casos)('resuelve "%s" → %s', (acto, esperadoId) => {
    expect(resolverPlazoId(catalog, acto)).toBe(esperadoId);
  });

  test('devuelve null sin acto procesal', () => {
    expect(resolverPlazoId(catalog, '')).toBeNull();
    expect(resolverPlazoId(catalog, null)).toBeNull();
  });
});

describe('providerRouter.mapToolChoice — multi-función', () => {
  const tools = [{ functionDeclarations: [{ name: 'a' }, { name: 'b' }] }];

  test('AUTO con tools → "auto" (NUNCA allowedFunctionNames[0])', () => {
    expect(mapToolChoice({ functionCallingConfig: { mode: 'AUTO', allowedFunctionNames: ['a', 'b'] } }, tools)).toBe('auto');
    expect(mapToolChoice({ functionCallingConfig: { mode: 'AUTO' } }, tools)).toBe('auto');
  });

  test('ANY con UNA función → fuerza tool_choice a esa función', () => {
    expect(mapToolChoice({ functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['emitirPrediccion'] } }, tools))
      .toEqual({ type: 'function', function: { name: 'emitirPrediccion' } });
  });

  test('ANY multi-función → degrada a "auto" (no usa [0] a ciegas)', () => {
    expect(mapToolChoice({ functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['a', 'b'] } }, tools)).toBe('auto');
  });

  test('NONE → "none"', () => {
    expect(mapToolChoice({ functionCallingConfig: { mode: 'NONE' } }, tools)).toBe('none');
  });

  test('sin tools → undefined (no enviar tool_choice)', () => {
    expect(mapToolChoice({ functionCallingConfig: { mode: 'AUTO' } }, undefined)).toBeUndefined();
    expect(mapToolChoice(undefined, tools)).toBeUndefined();
  });
});

describe('providerRouter.normalizeResponse — múltiples tool_calls', () => {
  test('procesa TODAS las tool_calls (no solo la primera)', () => {
    const data = {
      choices: [{
        message: {
          tool_calls: [
            { function: { name: 'calcular_plazo', arguments: '{"fecha_inicio":"2026-08-07"}' } },
            { function: { name: 'buscar_jurisprudencia', arguments: '{"query":"desalojo"}' } },
          ],
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    const r = normalizeResponse(data);
    expect(r.functionCalls).toHaveLength(2);
    expect(r.functionCalls[0]).toEqual({ name: 'calcular_plazo', args: { fecha_inicio: '2026-08-07' } });
    expect(r.functionCalls[1]).toEqual({ name: 'buscar_jurisprudencia', args: { query: 'desalojo' } });
    expect(r.usageMetadata.totalTokenCount).toBe(15);
  });

  test('argumentos inválidos → rawArguments (defensivo)', () => {
    const data = {
      choices: [{ message: { tool_calls: [{ function: { name: 'x', arguments: 'not-json' } }] } }],
      usage: {},
    };
    const r = normalizeResponse(data);
    expect(r.functionCalls[0].name).toBe('x');
    expect(r.functionCalls[0].args.rawArguments).toBe('not-json');
  });

  test('respuesta de texto normal → text', () => {
    const data = {
      choices: [{ message: { content: 'Respuesta legal' } }],
      usage: {},
    };
    expect(normalizeResponse(data).text).toBe('Respuesta legal');
  });
});

describe('data estructurada por tool (v3) — shapes canónicos', () => {
  const req = { logger: console, organizationId: 'test-org', user: { sub: 'test-user' } };

  test('calcular_plazo → data { acto_procesal, base_legal, fecha_inicio, dias_habiles, fecha_vencimiento, dias_calendario, consecuencia }', async () => {
    const r = await ejecutarHerramienta('calcular_plazo', {
      acto_procesal: 'apelar la sentencia civil',
      fecha_inicio: '2026-08-07',
    }, req);

    expect(r.texto).toContain('Cálculo de plazo procesal');
    expect(r.data).toMatchObject({
      acto_procesal: 'Apelación de sentencia',
      fecha_inicio: '2026-08-07',
      dias_habiles: 5,
    });
    expect(typeof r.data.base_legal).toBe('string');
    expect(r.data.base_legal).toContain('CPC');
    expect(r.data.fecha_vencimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof r.data.dias_calendario).toBe('number');
    expect(typeof r.data.consecuencia).toBe('string');
    // Compat v2 mantenida
    expect(r.data.dias_calendario_total).toBe(r.data.dias_calendario);
  });

  // SKILL: enrutamiento-intenciones-chat v1.1.0 — consulta conceptual sin fecha_inicio
  // (bug P0 reportado por auditor-legal 2026-08-08: "Cuánto tiempo tengo para
  // demandar contencioso-administrativo?" se atascaba pidiendo fecha).
  test('calcular_plazo SIN fecha_inicio → ficha del catálogo + pide fecha (no calcula)', async () => {
    const r = await ejecutarHerramienta('calcular_plazo', {
      acto_procesal: 'demanda contencioso-administrativa',
      // fecha_inicio omitida a propósito
    }, req);

    // Texto natural: debe pedir fecha, no inventar una.
    expect(r.texto).toContain('Información de plazo procesal');
    expect(r.texto).toContain('Demanda contencioso-administrativa');
    expect(r.texto).toContain('TUO Ley 27584');
    expect(r.texto).toContain('Indícame la fecha de inicio');
    expect(r.texto).not.toMatch(/Fecha de inicio:\s*\d{4}-\d{2}-\d{2}/); // NUNCA debe incluir fecha_inicio calculada.

    // Shape canónico: fecha_vencimiento y dias_calendario null.
    expect(r.data).toMatchObject({
      acto_procesal: 'Demanda contencioso-administrativa',
      base_legal: expect.stringContaining('TUO Ley 27584'),
      fecha_inicio: null,
      fecha_vencimiento: null,
      dias_calendario: null,
      dias_naturales: 90,
      dias_habiles: null,
      tipo: 'naturales',
      requiere_fecha_inicio: true,
    });
    expect(r.data.plazo_info.id).toBe('plazo_contencioso_administrativo');
    expect(typeof r.data.consecuencia).toBe('string');
  });

  test('calcular_plazo SIN fecha_inicio (args vacíos) → ficha del catálogo', async () => {
    // Simula el caso real donde FASE 0 no encuentra fecha y solo pasa acto_procesal.
    const r = await ejecutarHerramienta('calcular_plazo', {
      _texto: 'cuánto tiempo tengo para apelar una sentencia',
      acto_procesal: 'apelar una sentencia',
    }, req);

    expect(r.data.fecha_inicio).toBeNull();
    expect(r.data.fecha_vencimiento).toBeNull();
    expect(r.data.dias_calendario).toBeNull();
    expect(r.data.requiere_fecha_inicio).toBe(true);
    expect(r.data.acto_procesal).toBe('Apelación de sentencia');
    expect(r.data.dias_habiles).toBe(10); // CPC art. 367: sentencias en 10 días hábiles.
  });

  test('calcular_plazo SIN fecha_inicio con plazo sin dias fijos → ficha + nota (rama legacy)', async () => {
    // plazo_prescripcion_penal NO tiene `dias` numérico (es string "según pena...").
    // → cae en la rama legacy "no tiene número fijo de días" (diasHabiles == null),
    //   que ya NO devuelve requiere_fecha_inicio (mantiene shape legacy).
    const r = await ejecutarHerramienta('calcular_plazo', {
      acto_procesal: 'prescripción de la acción penal',
    }, req);

    expect(r.data.fecha_vencimiento).toBeNull();
    expect(r.data.dias_habiles).toBeNull();
    expect(r.texto).toContain('Prescripción de la acción penal');
    expect(r.texto).toContain('no tiene un número fijo de días');
  });

  test('calcular_plazo CON fecha_inicio vacía → ficha del catálogo (string vacío NO cuenta como fecha)', async () => {
    const r = await ejecutarHerramienta('calcular_plazo', {
      acto_procesal: 'contestación de demanda civil',
      fecha_inicio: '',
    }, req);

    expect(r.data.fecha_inicio).toBeNull();
    expect(r.data.fecha_vencimiento).toBeNull();
    expect(r.data.requiere_fecha_inicio).toBe(true);
  });

  test('redactar_documento → data { tipo, sumilla, fundamentos, petitorio, base_legal, formato_disponible }', async () => {
    const r = await ejecutarHerramienta('redactar_documento', {
      tipo_documento: 'demanda',
      materia: 'familia',
      hechos: 'Demanda de alimentos por incumplimiento de manutención.',
    }, req);

    expect(r.texto).toContain('Escrito');
    expect(r.data).toMatchObject({
      tipo: 'demanda',
      sumilla: 'SUMILLA DE PRUEBA',
      fundamentos: ['Fundamento 1 con cita legal'],
      petitorio: 'PETITORIO DE PRUEBA',
      base_legal: ['Art. X de la Ley Y'],
      formato_disponible: ['pdf', 'docx'],
    });
  });

  test('enrutarMensaje FASE 0 incluye data + contrato estable (tipo_respuesta/intencion/fase)', async () => {
    const r = await enrutarMensaje({
      mensaje: '¿Cuándo vence el plazo para apelar la sentencia civil?',
      req,
    });

    expect(r).not.toBeNull();
    expect(r.intent).toBe('calcular_plazo');
    expect(r.tipo_respuesta).toBe('plazo');
    expect(r.fase).toBe('fase0');
    expect(r.data).toBeTruthy();
    expect(r.data.dias_habiles).toBe(5);
    expect(r.data.fecha_vencimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('tipoRespuestaDeIntent: contrato estable por intención', () => {
    expect(tipoRespuestaDeIntent('redactar_documento')).toBe('escrito');
    expect(tipoRespuestaDeIntent('calcular_plazo')).toBe('plazo');
    expect(tipoRespuestaDeIntent('analizar_expediente')).toBe('analisis');
    expect(tipoRespuestaDeIntent('buscar_jurisprudencia')).toBe('jurisprudencia');
    expect(tipoRespuestaDeIntent('predecir_resultado')).toBe('prediccion');
    expect(tipoRespuestaDeIntent(null)).toBe('respuesta');
  });
});
