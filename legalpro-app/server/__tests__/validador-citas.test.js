/**
 * TESTS — utils/validadorCitas.js (validador de citas legales en RUNTIME)
 * ─────────────────────────────────────────────────────────────────────────────
 * Anti-alucinación: extrae citas (Artículo/Ley/D.Leg-D.S-TUO) de texto IA y las
 * verifica contra catalogs/codigos-leyes.json (258 normas, cache en memoria).
 *
 * Casos cubiertos:
 *  1. extraerCitas: 3 citas reales (articulo + ley + dispositivo) + dedup.
 *  2. validarCitas: los 3 estados — 'verificada' (CP art. 149 ∈ articulos_mas_citados),
 *     'norma_existe_articulo_desconocido' (CP art. 9999 ∉ catálogo),
 *     'no_encontrada' (norma inventada).
 *  3. Fuzzy-match insensible a tildes ("Código Procesal Penal" → "Nuevo Código
 *     Procesal Penal") y match por número ("Ley 30077", "D.Leg. 1249").
 *  4. validarRespuestaIA: ratio_verificacion = verificadas/total y sospechosas[].
 *  5. Fail-open: texto sin citas → ratio 1; input inválido no lanza.
 */
import { describe, it, expect } from 'vitest';
import {
  extraerCitas,
  validarCitas,
  validarRespuestaIA,
  quitarTildes,
} from '../utils/validadorCitas.js';

describe('extraerCitas', () => {
  it('extrae 3 citas de un texto real: artículo, ley y dispositivo', () => {
    const texto = [
      'Conforme al artículo 149 del Código Penal, la integración a una organización',
      'criminal se sanciona con pena privativa de libertad. La Ley 30077 complementa',
      'este régimen y el D.Leg. 1249 tipifica el lavado de activos como delito autónomo.',
    ].join(' ');

    const citas = extraerCitas(texto);

    expect(citas).toHaveLength(3);
    const articulo = citas.find(c => c.tipo === 'articulo');
    const ley = citas.find(c => c.tipo === 'ley');
    const dispositivo = citas.find(c => c.tipo === 'dispositivo');

    expect(articulo).toMatchObject({ tipo: 'articulo', numero: '149', norma: 'Código Penal' });
    expect(ley).toMatchObject({ tipo: 'ley', numero: '30077' });
    expect(dispositivo).toMatchObject({ tipo: 'dispositivo', numero: '1249' });
    // Cada cita conserva el match original para trazabilidad
    expect(articulo.match).toContain('149');
  });

  it('normaliza tildes en la extracción ("Artículo" con tilde) y deduplica', () => {
    const texto = 'Según el Artículo 2 de la Constitución Política del Perú. Según el Artículo 2 de la Constitución Política del Perú.';
    const citas = extraerCitas(texto);
    expect(citas).toHaveLength(1); // dedup por tipo|numero|norma
    expect(citas[0]).toMatchObject({ tipo: 'articulo', numero: '2', norma: 'Constitución Política del Perú' });
  });

  it('retorna [] para texto sin citas o inválido', () => {
    expect(extraerCitas('Hola, ¿cómo estás?')).toEqual([]);
    expect(extraerCitas(null)).toEqual([]);
    expect(extraerCitas(undefined)).toEqual([]);
  });
});

describe('quitarTildes', () => {
  it('elimina diacríticos preservando el resto', () => {
    expect(quitarTildes('Código Procesal Penal')).toBe('Codigo Procesal Penal');
    expect(quitarTildes('Ley N° 29733')).toBe('Ley N° 29733'); // símbolos intactos
  });
});

describe('validarCitas', () => {
  it('verifica cita exacta: CP art. 149 está en articulos_mas_citados', async () => {
    const [r] = await validarCitas([
      { tipo: 'articulo', numero: '149', norma: 'Código Penal', match: 'artículo 149 del Código Penal' },
    ]);
    expect(r.estado).toBe('verificada');
    expect(r.norma_id).toBe('cp');
  });

  it('marca norma_existe_articulo_desconocido cuando el artículo no figura (CP art. 9999)', async () => {
    const [r] = await validarCitas([
      { tipo: 'articulo', numero: '9999', norma: 'Código Penal', match: 'artículo 9999 del Código Penal' },
    ]);
    expect(r.estado).toBe('norma_existe_articulo_desconocido');
    expect(r.norma_id).toBe('cp');
  });

  it('marca no_encontrada cuando la norma es inventada', async () => {
    const [r] = await validarCitas([
      { tipo: 'articulo', numero: '7', norma: 'Código Marcial de Narnia', match: 'artículo 7 del Código Marcial de Narnia' },
    ]);
    expect(r.estado).toBe('no_encontrada');
    expect(r.norma_id).toBeUndefined();
  });

  it('fuzzy-match insensible a tildes: "Código Procesal Penal" → Nuevo Código Procesal Penal', async () => {
    const [r] = await validarCitas([
      { tipo: 'articulo', numero: '375', norma: 'Código Procesal Penal', match: 'artículo 375 del Código Procesal Penal' },
    ]);
    // 375 ∈ articulos_mas_citados del NCPP (alegatos de clausura)
    expect(r.estado).toBe('verificada');
    expect(r.norma_id).toBe('ncpp');
  });

  it('resuelve leyes por número: "Ley 30077" existe → verificada', async () => {
    const [r] = await validarCitas([
      { tipo: 'ley', numero: '30077', norma: 'Ley 30077', match: 'Ley 30077' },
    ]);
    expect(r.estado).toBe('verificada');
    expect(r.norma_id).toBe('crimen-organizado');
  });

  it('resuelve dispositivos por número: "D.Leg. 1249" (lavado de activos)', async () => {
    const [r] = await validarCitas([
      { tipo: 'dispositivo', numero: '1249', norma: 'D.Leg. 1249', match: 'D.Leg. 1249' },
    ]);
    expect(r.estado).toBe('verificada');
    expect(r.norma_id).toBe('lavado-activos');
  });

  it('ley inexistente → no_encontrada', async () => {
    const [r] = await validarCitas([
      { tipo: 'ley', numero: '99999', norma: 'Ley 99999', match: 'Ley 99999' },
    ]);
    expect(r.estado).toBe('no_encontrada');
  });

  it('acepta variante de artículo con sufijo ("185-A" ≈ "185")', async () => {
    const [r] = await validarCitas([
      { tipo: 'articulo', numero: '185-A', norma: 'Código Penal', match: 'artículo 185-A del Código Penal' },
    ]);
    expect(r.estado).toBe('verificada');
  });
});

describe('validarRespuestaIA', () => {
  it('calcula ratio_verificacion y lista sospechosas (1 verificada / 3 total ≈ 0.33)', async () => {
    const texto = [
      'El artículo 149 del Código Penal sanciona la organización criminal.',
      'Además, el artículo 9999 del Código Penal sería aplicable.', // artículo inventado
      'Véase también el artículo 5 del Código Marcial de Narnia.',   // norma inventada
    ].join(' ');

    const r = await validarRespuestaIA(texto);

    expect(r.citas_total).toBe(3);
    expect(r.verificadas).toBe(1);
    expect(r.ratio_verificacion).toBeCloseTo(0.33, 2);
    expect(r.sospechosas).toHaveLength(2);
    expect(r.sospechosas.map(s => s.estado).sort()).toEqual(
      ['no_encontrada', 'norma_existe_articulo_desconocido']
    );
    // Las sospechosas exponen lo mínimo para que el frontend marque la cita
    for (const s of r.sospechosas) {
      expect(s).toHaveProperty('tipo');
      expect(s).toHaveProperty('numero');
      expect(s).toHaveProperty('norma');
      expect(s).toHaveProperty('estado');
    }
  });

  it('respuesta 100% verificable → ratio 1 y sin sospechosas', async () => {
    const texto = 'El artículo 149 del Código Penal y la Ley 30077 son aplicables al caso.';
    const r = await validarRespuestaIA(texto);
    expect(r.citas_total).toBe(2);
    expect(r.verificadas).toBe(2);
    expect(r.ratio_verificacion).toBe(1);
    expect(r.sospechosas).toEqual([]);
  });

  it('texto sin citas → citas_total 0, ratio 1 (nada sospechoso), fail-open', async () => {
    const r = await validarRespuestaIA('Respuesta sin ninguna cita legal específica.');
    expect(r.citas_total).toBe(0);
    expect(r.verificadas).toBe(0);
    expect(r.ratio_verificacion).toBe(1);
    expect(r.sospechosas).toEqual([]);
  });

  it('input inválido (null/no-string) no lanza y devuelve estructura segura', async () => {
    for (const bad of [null, undefined, 42, {}]) {
      const r = await validarRespuestaIA(bad);
      expect(r).toMatchObject({ citas_total: 0, verificadas: 0, sospechosas: [], ratio_verificacion: 1 });
    }
  });
});
