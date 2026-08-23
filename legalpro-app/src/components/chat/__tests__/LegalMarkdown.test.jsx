// legalpro-app/src/components/chat/__tests__/LegalMarkdown.test.jsx
// Smoke tests del renderer markdown legal: pipeline completo y sanitización.

import { describe, it, expect } from 'vitest';
import { mdToHtml } from '../LegalMarkdown';

describe('mdToHtml', () => {
  it('escapa HTML crudo antes de cualquier procesamiento', () => {
    const out = mdToHtml('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('renderiza tablas markdown con thead/tbody', () => {
    const out = mdToHtml('| Plazo | Fuente |\n| --- | --- |\n| 5 días | TUO LPCL |');
    expect(out).toContain('<table');
    expect(out).toContain('<th class=');
    expect(out).toContain('<td class=');
    expect(out).toContain('Plazo');
  });

  it('renderiza blockquotes como cita legal', () => {
    const out = mdToHtml('> La cosa juzgada es inviolable.');
    expect(out).toMatch(/<blockquote class="[^"]*font-serif/);
    expect(out).toContain('cosa juzgada');
  });

  it('renderiza headers ## y ### jerárquicos', () => {
    const out = mdToHtml('## Análisis\n### Fortalezas');
    expect(out).toContain('text-cyan-300 font-bold text-sm');
    expect(out).toContain('text-cyan-200 font-semibold text-[13px]');
  });

  it('renderiza listas con anidamiento por indentación', () => {
    const out = mdToHtml('- Nivel 1\n  - Nivel 2\n1. Primero');
    expect(out).toContain('ml-1');
    expect(out).toContain('ml-4');
    expect(out).toContain('Primero');
  });

  it('envuelve citas legales en chips', () => {
    const out = mdToHtml('Conforme al [Art. 108 CP] y la Ley N° 27444 (D.S. 004-2019-JUS) [Fuente: SPIJ]. Ver TUO.');
    expect(out.match(/bg-cyan-500\/10/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('renderiza bold, italic y code inline', () => {
    const out = mdToHtml('**clave** y *matiz* y `articulo_108`');
    expect(out).toContain('<strong');
    expect(out).toContain('<em>');
    expect(out).toContain('<code class="bg-slate-800');
  });

  it('convierte --- en hr y separa párrafos por doble salto', () => {
    const out = mdToHtml('Párrafo uno.\n\n---\n\nPárrafo dos.');
    expect(out).toContain('<hr class="border-white/10 my-3"/>');
    expect(out.match(/class="mb-2"/g)?.length).toBe(2);
  });

  it('no deja placeholders de código sin resolver', () => {
    const out = mdToHtml('texto con `codigo` dentro');
    expect(out).not.toContain('\u0000');
    expect(out).toContain('codigo');
  });
});
