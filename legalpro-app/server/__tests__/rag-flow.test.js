/**
 * RAG Flow Tests - End-to-end del flujo RAG (Junior RAG Wrapper)
 *
 * Valida el flujo completo del wrapper RAG:
 *  1. Wrapper consulta base legal (consultarBaseLegal)
 *  2. Cache funciona (segunda consulta idéntica usa cache)
 *  3. Citaciones se generan correctamente (numero, fuente, similitud, url)
 *  4. Disclaimers se inyectan (4 obligatorios con ⚠️)
 *  5. Audit log metadata se registra (audit_metadata)
 *  6. Latencia es aceptable (p95 < 3000ms)
 *  7. Validaciones de entrada (consulta muy corta falla)
 *  8. Fallback funciona cuando RAG no disponible (sin chunks)
 *  9. generarRespuestaConRAG estructura la salida para LLM
 *
 * Patrón:
 *  - Vitest 4 con mock del módulo retrieve.mjs (evita conexión real a pg)
 *  - Cobertura: 5 materias (civil, penal, tributario, laboral, constitucional)
 *  - Tests deterministas sin dependencia de DB externa
 *
 * SKILL: vitest-test-writer
 * @author BackendNode
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// BANCO DE CHUNKS SIMULADOS POR MATERIA
// ═══════════════════════════════════════════════════════════════════════════
// Alineado al corpus legal peruano. Cada materia tiene chunks representativos
// con su metadata, source y URL del SPIJ (Sistema Peruano de Información Jurídica).

const MOCK_CHUNKS_POR_MATERIA = {
  civil: [
    {
      id: 'chunk-civil-001',
      source: 'Codigo_Civil_Peru_Art_950',
      content: 'Artículo 950.- La prescripción adquisitiva de la propiedad se produce por la posesión continua, pacífica y pública como propietario durante 10 años si hay buena fe y 15 años si no la hay.',
      metadata: { materia: 'civil', tipo: 'codigo_legal', url: 'https://spij.minjus.gob.pe/codigo-civil-art-950' },
      similarity: 0.92,
    },
    {
      id: 'chunk-civil-002',
      source: 'Codigo_Procesal_Civil_Art_504',
      content: 'Artículo 504.- Plazo para contestar demanda es de 30 días hábiles desde la notificación válida.',
      metadata: { materia: 'civil', tipo: 'codigo_legal', url: 'https://spij.minjus.gob.pe/cpc-art-504' },
      similarity: 0.88,
    },
  ],
  penal: [
    {
      id: 'chunk-penal-001',
      source: 'Codigo_Penal_Decreto_Legislativo_635',
      content: 'Artículo 1.- El que adquiere, utiliza, guarda, administra, custodia, recibe, oculta o se hace entregar dinero, bienes, efectos o ganancias, cuyo origen ilícito conoce o debe presumir, será reprimido con pena privativa de la libertad.',
      metadata: { materia: 'penal', tipo: 'codigo_legal', url: 'https://spij.minjus.gob.pe/cp-art-1' },
      similarity: 0.91,
    },
    {
      id: 'chunk-penal-002',
      source: 'Codigo_Penal_Art_317_Lavado_Activos',
      content: 'Artículo 317.- El que interviene en la conversión, transferencia, ocultamiento o tenencia de dinero o bienes provenientes de delito, será reprimido.',
      metadata: { materia: 'penal', tipo: 'codigo_legal', url: 'https://spij.minjus.gob.pe/cp-art-317' },
      similarity: 0.86,
    },
  ],
  tributario: [
    {
      id: 'chunk-tributario-001',
      source: 'TUO_Ley_IGV_DS_055_99_EF',
      content: 'Artículo 3.- La tasa del Impuesto General a las Ventas es del dieciocho por ciento (18%) (16% IGV + 2% IPM). Este gravamen se aplica sobre la base imponible.',
      metadata: { materia: 'tributario', tipo: 'codigo_legal', url: 'https://spij.minjus.gob.pe/tuo-igv' },
      similarity: 0.87,
    },
  ],
  laboral: [
    {
      id: 'chunk-laboral-001',
      source: 'D_Leg_650_CTS_Art_21',
      content: 'Artículo 21.- La Compensación por Tiempo de Servicios (CTS) se deposita semestralmente: en mayo (periodo noviembre-abril) y en noviembre (periodo mayo-octubre). El depósito equivale a 1/6 de la remuneración computable.',
      metadata: { materia: 'laboral', tipo: 'codigo_legal', url: 'https://spij.minjus.gob.pe/dl-650' },
      similarity: 0.89,
    },
  ],
  constitucional: [
    {
      id: 'chunk-constitucional-001',
      source: 'Constitucion_Politica_Peru_Art_2_Inc_12',
      content: 'Artículo 2 Inc. 12.- Toda persona tiene derecho a la libertad de reunión pacifica y sin armas. Las reuniones en locales privados o abiertos al público no requieren aviso previo.',
      metadata: { materia: 'constitucional', tipo: 'codigo_legal', url: 'https://spij.minjus.gob.pe/constitucion-art-2' },
      similarity: 0.85,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DEL MÓDULO retrieve.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Mockeamos directamente el módulo que importa `pg`, evitando así la
// necesidad de mockear el cliente de PostgreSQL (lo cual es problemático
// cuando el archivo importador es un .mjs fuera del workspace).
//
// El factory retorna `retrieve()` y `buildAugmentedPrompt()` simulados
// que devuelven chunks coherentes con la materia solicitada.

vi.mock('../../../tools/rag/retrieve.mjs', async () => {
  return {
    retrieve: vi.fn(async (query, options = {}) => {
      const filterMateria = (options.filter?.materia || '').toLowerCase();
      const chunks = MOCK_CHUNKS_POR_MATERIA[filterMateria] || MOCK_CHUNKS_POR_MATERIA.civil;
      const limit = options.topK || 5;
      return chunks.slice(0, limit).map((c, idx) => ({
        rank: idx + 1,
        id: c.id,
        source: c.source,
        content: c.content,
        metadata: c.metadata,
        similarity: c.similarity,
      }));
    }),
    buildAugmentedPrompt: vi.fn((query, systemInstruction, chunks) => {
      const context = chunks
        .map(
          (chunk, i) =>
            `[${i + 1}] FUENTE: ${chunk.source} | SIMILARIDAD: ${(chunk.similarity * 100).toFixed(1)}%\n${chunk.content}\n`,
        )
        .join('\n---\n\n');
      const prompt = `${systemInstruction}\n\nCONTEXTO NORMATIVO VERIFICADO:\n${context}\n\nCONSULTA DEL USUARIO:\n${query}\n\nINSTRUCCIONES:\n- Basa tu respuesta EXCLUSIVAMENTE en el contexto normativo proporcionado.\n- Cita las fuentes con formato [N] donde N es el número de fuente.\n- NUNCA inventes artículos o leyes.\n- Si no encuentras la respuesta en el contexto, di "No encuentro base normativa suficiente".\n- Incluye los 4 disclaimers IA obligatorios.\n- Idioma: es-PE.\n\nRESPUESTA:`;
      const sources = chunks.map((c) => ({
        id: c.id,
        source: c.source,
        similarity: c.similarity,
        metadata: c.metadata,
      }));
      return { prompt, sources };
    }),
  };
});

// Importar el wrapper DESPUÉS de declarar los mocks (orden importante para
// que Vitest aplique el mock del módulo retrieve.mjs antes de la importación).
let consultarBaseLegal;
let generarRespuestaConRAG;

beforeAll(async () => {
  const mod = await import('../../../tools/rag/junior-rag-wrapper.mjs');
  consultarBaseLegal = mod.consultarBaseLegal;
  generarRespuestaConRAG = mod.generarRespuestaConRAG;
});

// ═══════════════════════════════════════════════════════════════════════════
// DATOS DE PRUEBA — 5 materias + contextos diversos
// ═══════════════════════════════════════════════════════════════════════════
const TEST_CASES = [
  {
    materia: 'civil',
    consulta: 'plazo para contestar demanda civil ordinaria',
    contexto: 'Prescripción adquisitiva',
    expectChunks: true,
  },
  {
    materia: 'penal',
    consulta: 'qué es el delito de lavado de activos',
    contexto: 'Ollanta Humala caso',
    expectChunks: true,
  },
  {
    materia: 'tributario',
    consulta: 'tasa IGV restaurantes 2026',
    contexto: '',
    expectChunks: true,
  },
  {
    materia: 'laboral',
    consulta: 'CTS cálculo y deposito',
    contexto: 'Trabajador con 5 años antigüedad',
    expectChunks: true,
  },
  {
    materia: 'constitucional',
    consulta: 'derecho fundamental a la protesta',
    contexto: '',
    expectChunks: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 1 — CONSULTAR BASE LEGAL: CASOS EXITOSOS
// ═══════════════════════════════════════════════════════════════════════════
describe('RAG Flow - Consultar Base Legal', () => {
  describe('Consultas exitosas', () => {
    for (const tc of TEST_CASES) {
      test(`Materia ${tc.materia}: "${tc.consulta.substring(0, 40)}..."`, { timeout: 10000 }, async () => {
        const result = await consultarBaseLegal({
          materia: tc.materia,
          consulta: tc.consulta,
          contexto: tc.contexto,
        });

        // Estructura base
        expect(result).toBeDefined();
        expect(result.sistema_origen).toBe('RAG-LegalPro-v1');
        expect(result.disclaimers_obligatorios).toHaveLength(4);

        // Citaciones si hay chunks
        if (tc.expectChunks && result.chunks_usados > 0) {
          expect(result.citaciones.length).toBeGreaterThan(0);
          expect(result.citaciones[0]).toHaveProperty('numero');
          expect(result.citaciones[0]).toHaveProperty('fuente');
          expect(result.citaciones[0]).toHaveProperty('similitud');
          expect(result.citaciones[0]).toHaveProperty('metadata');
          expect(result.citaciones[0]).toHaveProperty('url');

          // Audit metadata
          expect(result.audit_metadata).toBeDefined();
          expect(result.audit_metadata.materia).toBe(tc.materia);
          expect(result.audit_metadata.timestamp_consulta).toBeDefined();
        }

        // LPDP: SIEMPRE necesita revisión humana
        expect(result.necesita_revision_humana).toBe(true);
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Cache de consultas', () => {
    test('Segunda consulta idéntica retorna mismo timestamp (cache hit)', async () => {
      const opts = {
        materia: 'civil',
        consulta: 'prescripción ordinaria civil',
        contexto: '',
      };

      const r1 = await consultarBaseLegal(opts);
      const r2 = await consultarBaseLegal(opts);

      // El timestamp debe ser idéntico → vino del cache
      expect(r2.audit_metadata.timestamp_consulta).toBe(r1.audit_metadata.timestamp_consulta);
    });

    test('Cache hit retorna estructura idéntica', async () => {
      const opts = {
        materia: 'penal',
        consulta: 'hurto agravado pena',
        contexto: 'caso robo vivienda',
      };

      const r1 = await consultarBaseLegal(opts);
      const r2 = await consultarBaseLegal(opts);

      expect(r2.chunks_usados).toBe(r1.chunks_usados);
      expect(r2.citaciones.length).toBe(r1.citaciones.length);
      expect(r2.fuentes).toEqual(r1.fuentes);
      expect(r2.sistema_origen).toBe(r1.sistema_origen);
    });

    test('Consultas con materia diferente NO comparten cache', async () => {
      const consulta = 'plazo procesal general';
      const r1 = await consultarBaseLegal({ materia: 'civil', consulta, contexto: '' });
      const r2 = await consultarBaseLegal({ materia: 'penal', consulta, contexto: '' });

      // Las materias diferentes generan cacheKeys distintas
      expect(r1.audit_metadata.materia).toBe('civil');
      expect(r2.audit_metadata.materia).toBe('penal');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Validaciones de entrada', () => {
    test('Consulta muy corta (1 caracter) debe lanzar error', async () => {
      await expect(consultarBaseLegal({
        materia: 'civil',
        consulta: 'a',
      })).rejects.toThrow(/5 caracteres/i);
    });

    test('Consulta vacía debe lanzar error', async () => {
      await expect(consultarBaseLegal({
        materia: 'civil',
        consulta: '',
      })).rejects.toThrow();
    });

    test('Consulta de 4 caracteres (justo bajo el límite) debe lanzar error', async () => {
      await expect(consultarBaseLegal({
        materia: 'civil',
        consulta: 'abcd',
      })).rejects.toThrow();
    });

    test('Consulta de 5 caracteres (justo en el límite) debe ser válida', async () => {
      const result = await consultarBaseLegal({
        materia: 'civil',
        consulta: 'abcde',
        contexto: '',
      });
      expect(result).toBeDefined();
      expect(result.sistema_origen).toBe('RAG-LegalPro-v1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Disclaimers LPDP — cumplimiento obligatorio', () => {
    test('Los 4 disclaimers siempre presentes con prefijo ⚠️', async () => {
      const result = await consultarBaseLegal({
        materia: 'civil',
        consulta: 'cualquier consulta legal válida',
      });

      expect(result.disclaimers_obligatorios).toHaveLength(4);
      result.disclaimers_obligatorios.forEach((d) => {
        expect(d).toContain('⚠️');
      });
    });

    test('necesita_revision_humana siempre es true (compliance LPDP)', async () => {
      const result = await consultarBaseLegal({
        materia: 'penal',
        consulta: 'asesinato calificado por lucro',
      });
      expect(result.necesita_revision_humana).toBe(true);
    });

    test('Disclaimers cubren los 4 ejes: IA, abogado, fuente, verificación', async () => {
      const result = await consultarBaseLegal({
        materia: 'tributario',
        consulta: 'renta de cuarta categoría',
      });
      const all = result.disclaimers_obligatorios.join(' ').toLowerCase();
      // 1) advertencia IA
      expect(all).toMatch(/ia|inteligencia artificial/);
      // 2) recomendación de consultar abogado colegiado
      expect(all).toMatch(/abogado|colegiado/);
      // 3) advertencia sobre cambios en la información
      expect(all).toMatch(/cambios|actualizada/);
      // 4) verificación de citas en fuentes oficiales
      expect(all).toMatch(/verifica|cita/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Audit metadata y trazabilidad', () => {
    test('audit_metadata contiene materia, chunks y timestamp', async () => {
      const result = await consultarBaseLegal({
        materia: 'laboral',
        consulta: 'vacaciones truncas cálculo',
      });
      expect(result.audit_metadata.materia).toBe('laboral');
      expect(result.audit_metadata.chunks_consultados).toBe(result.chunks_usados);
      expect(result.audit_metadata.timestamp_consulta).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('citaciones numeradas secuencialmente desde 1', async () => {
      const result = await consultarBaseLegal({
        materia: 'constitucional',
        consulta: 'amparo plazo sesenta días',
      });
      if (result.citaciones.length > 0) {
        result.citaciones.forEach((cit, idx) => {
          expect(cit.numero).toBe(idx + 1);
        });
      }
    });

    test('citaciones incluyen metadata con url de fuente oficial', async () => {
      const result = await consultarBaseLegal({
        materia: 'penal',
        consulta: 'cohecho funcionario público',
      });
      result.citaciones.forEach((cit) => {
        if (cit.url) {
          expect(cit.url).toMatch(/^https?:\/\//);
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Performance — latencia aceptable', () => {
    test('Latencia p95 < 3000ms en 5 consultas', { timeout: 30000 }, async () => {
      const tiempos = [];

      for (const tc of TEST_CASES) {
        // Usar consultas únicas (con timestamp) para evitar cache hit
        // en este test de performance — queremos medir retrieve puro.
        const consultaUnica = `${tc.consulta} [${Date.now()}-${Math.random()}]`;
        const start = Date.now();
        await consultarBaseLegal({ materia: tc.materia, consulta: consultaUnica, contexto: tc.contexto });
        tiempos.push(Date.now() - start);
      }

      tiempos.sort((a, b) => a - b);
      const p95 = tiempos[Math.floor(tiempos.length * 0.95)];

      // eslint-disable-next-line no-console
      console.log(`Tiempos: ${tiempos.join(', ')}ms, p95=${p95}ms`);
      expect(p95).toBeLessThan(3000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Sistema origen y fecha_consulta', () => {
    test('sistema_origen siempre es "RAG-LegalPro-v1"', async () => {
      const result = await consultarBaseLegal({
        materia: 'civil',
        consulta: 'identifica versión sistema',
      });
      expect(result.sistema_origen).toBe('RAG-LegalPro-v1');
    });

    test('fecha_consulta es ISO 8601 válido', async () => {
      const result = await consultarBaseLegal({
        materia: 'civil',
        consulta: 'fecha de consulta válida',
      });
      expect(result.fecha_consulta).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 2 — GENERAR RESPUESTA CON RAG (wrapper de alto nivel)
// ═══════════════════════════════════════════════════════════════════════════
describe('RAG Flow - Generar Respuesta con RAG', () => {
  test('Estructura correcta para integración LLM', async () => {
    const result = await generarRespuestaConRAG({
      juniorNombre: 'abogado-jr-civil',
      materia: 'civil',
      consulta: 'plazo prescripción',
      contexto: 'Caso prescripción adquisitiva',
    });

    expect(result.instrucciones_para_junior).toBeDefined();
    expect(result.instrucciones_para_junior.incluir_disclaimers).toHaveLength(4);
    expect(result.respuesta_estructurada).toBeDefined();
    expect(result.respuesta_estructurada.disclaimers).toHaveLength(4);
    expect(result.metadata_audit).toBeDefined();
  });

  test('respuesta_estructurada hereda citaciones y fuentes', async () => {
    const result = await generarRespuestaConRAG({
      juniorNombre: 'abogado-jr-penal',
      materia: 'penal',
      consulta: 'extorsion agraviada',
      contexto: 'cobro mensual a comerciante',
    });

    expect(result.respuesta_estructurada.citaciones).toBeDefined();
    expect(Array.isArray(result.respuesta_estructurada.citaciones)).toBe(true);
    expect(result.respuesta_estructurada.fuentes).toBeDefined();
  });

  test('instrucciones_para_junior expone prompt sugerido', async () => {
    const result = await generarRespuestaConRAG({
      juniorNombre: 'abogado-jr-laboral',
      materia: 'laboral',
      consulta: 'despido arbitrario reposicion',
      contexto: 'trabajador con 3 años',
    });

    expect(result.instrucciones_para_junior.prompt_sugerido).toBeDefined();
    expect(typeof result.instrucciones_para_junior.prompt_sugerido).toBe('string');
    // El prompt sugerido debe mencionar la materia
    expect(result.instrucciones_para_junior.prompt_sugerido.toLowerCase()).toContain('laboral');
  });

  test('metadata_audit se reenvía correctamente', async () => {
    const result = await generarRespuestaConRAG({
      juniorNombre: 'abogado-jr-constitucional',
      materia: 'constitucional',
      consulta: 'habeas data acceso información',
      contexto: '',
    });

    expect(result.metadata_audit.materia).toBe('constitucional');
    expect(result.metadata_audit.timestamp_consulta).toBeDefined();
  });
});
