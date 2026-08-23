// legalpro-app/src/hooks/__tests__/useWidgetLayout.test.js
// Tests puros de las transformaciones del layout del Dashboard V2
// (reordenar, agrupar, desagrupar, mover ↑↓ y normalización de storage).

import { describe, it, expect } from 'vitest';
import {
  WIDGET_DEFS,
  DEFAULT_LAYOUT,
  flatItemOrder,
  insertWidget,
  joinOrCreateGroup,
  ungroupOne,
  moveItemByOffset,
  normalizeLayout,
} from '../useWidgetLayout';

const S1 = DEFAULT_LAYOUT.sections[0]; // resumen: kpis, actividad, vencimientos, expedientes
const S2 = DEFAULT_LAYOUT.sections[1]; // analisis: materia, sinoe, creditos, calc

const ids = (sections) =>
  sections.map((s) => s.items.map((it) => (it.t === 'g' ? `G(${it.widgets.join(',')})` : it.id)));

/** Id del grupo que contiene a un widget dado */
const groupOf = (sections, widgetId) => {
  const g = sections.flatMap((s) => s.items).find((it) => it.t === 'g' && it.widgets.includes(widgetId));
  expect(g).toBeDefined();
  return g.id;
};

describe('integridad del catálogo', () => {
  it('todo widget del default existe en WIDGET_DEFS y viceversa', () => {
    const used = DEFAULT_LAYOUT.sections.flatMap((s) => s.items.map((it) => it.id));
    used.forEach((id) => expect(WIDGET_DEFS[id]).toBeDefined());
    expect(used.length).toBe(Object.keys(WIDGET_DEFS).length);
  });
});

describe('insertWidget (reordenar drag&drop)', () => {
  it('mueve un widget antes de otro dentro de la misma sección', () => {
    const out = insertWidget(DEFAULT_LAYOUT.sections, 'expedientes', S1.id, 'actividad', 'before');
    expect(ids(out)[0]).toEqual(['kpis', 'expedientes', 'actividad', 'vencimientos']);
  });

  it('mueve un widget entre secciones (anchor en otra sección)', () => {
    const out = insertWidget(DEFAULT_LAYOUT.sections, 'kpis', S2.id, 'materia', 'after');
    expect(ids(out)[0]).toEqual(['actividad', 'vencimientos', 'expedientes']);
    expect(ids(out)[1]).toEqual(['materia', 'kpis', 'sinoe', 'creditos', 'calc']);
  });

  it('sin anchor añade al final de la sección destino', () => {
    const out = insertWidget(DEFAULT_LAYOUT.sections, 'calc', S1.id);
    expect(ids(out)[0]).toEqual(['kpis', 'actividad', 'vencimientos', 'expedientes', 'calc']);
    expect(ids(out)[1]).toEqual(['materia', 'sinoe', 'creditos']);
  });

  it('retira el widget de su grupo original si estaba agrupado', () => {
    const grouped = joinOrCreateGroup(DEFAULT_LAYOUT.sections, 'calc', 'sinoe');
    const out = insertWidget(grouped, 'calc', S1.id); // saca calc del grupo y lo mueve
    expect(ids(out)[1]).toEqual(['materia', 'sinoe', 'creditos']); // grupo disuelto → sinoe suelto
    expect(ids(out)[0].at(-1)).toBe('calc');
  });

  it('es inmutable: no muta las secciones de entrada', () => {
    const before = JSON.stringify(DEFAULT_LAYOUT.sections);
    insertWidget(DEFAULT_LAYOUT.sections, 'kpis', S2.id);
    expect(JSON.stringify(DEFAULT_LAYOUT.sections)).toBe(before);
  });
});

describe('joinOrCreateGroup (soltar sobre otro widget)', () => {
  it('crea un grupo con ambos widgets en la posición del target', () => {
    const out = joinOrCreateGroup(DEFAULT_LAYOUT.sections, 'creditos', 'materia');
    expect(ids(out)[1][0]).toBe('G(materia,creditos)');
  });

  it('añade a un grupo existente al soltar sobre el grupo', () => {
    let out = joinOrCreateGroup(DEFAULT_LAYOUT.sections, 'creditos', 'materia');
    const groupId = groupOf(out, 'materia');
    out = joinOrCreateGroup(out, 'calc', groupId);
    expect(ids(out)[1][0]).toBe('G(materia,creditos,calc)');
  });

  it('ignora soltar un widget sobre sí mismo o si ya pertenece al grupo', () => {
    expect(joinOrCreateGroup(DEFAULT_LAYOUT.sections, 'materia', 'materia')).toBe(DEFAULT_LAYOUT.sections);
    let out = joinOrCreateGroup(DEFAULT_LAYOUT.sections, 'creditos', 'materia');
    const groupId = groupOf(out, 'materia');
    expect(joinOrCreateGroup(out, 'creditos', groupId)).toBe(out);
  });
});

describe('ungroupOne', () => {
  it('extrae un widget dejándolo justo después del grupo', () => {
    let out = joinOrCreateGroup(DEFAULT_LAYOUT.sections, 'creditos', 'materia');
    const groupId = groupOf(out, 'materia');
    out = ungroupOne(out, groupId, 'creditos');
    // el grupo queda con 1 widget → se disuelve en widget suelto
    expect(ids(out)[1]).toEqual(['materia', 'creditos', 'sinoe', 'calc']);
  });

  it('disuelve el grupo si queda con un solo widget', () => {
    let out = joinOrCreateGroup(DEFAULT_LAYOUT.sections, 'creditos', 'materia');
    const groupId = groupOf(out, 'materia');
    out = ungroupOne(out, groupId, 'creditos'); // grupo queda con [materia]
    out = ungroupOne(out, groupId, 'materia'); // ahora se extrae el último
    expect(ids(out)[1]).toEqual(['materia', 'creditos', 'sinoe', 'calc']);
  });
});

describe('moveItemByOffset (flechas ↑↓, móvil)', () => {
  it('sube y baja dentro de la misma sección', () => {
    const up = moveItemByOffset(DEFAULT_LAYOUT.sections, 'actividad', -1);
    expect(ids(up)[0]).toEqual(['actividad', 'kpis', 'vencimientos', 'expedientes']);
    const down = moveItemByOffset(DEFAULT_LAYOUT.sections, 'kpis', 1);
    expect(ids(down)[0]).toEqual(['actividad', 'kpis', 'vencimientos', 'expedientes']);
  });

  it('cruza secciones: subir desde el primero lo manda al final de la sección anterior', () => {
    const out = moveItemByOffset(DEFAULT_LAYOUT.sections, 'materia', -1);
    expect(ids(out)[0].at(-1)).toBe('materia');
    expect(ids(out)[1][0]).toBe('sinoe');
  });

  it('bajar desde el último lo manda al inicio de la siguiente sección', () => {
    const out = moveItemByOffset(DEFAULT_LAYOUT.sections, 'expedientes', 1);
    expect(ids(out)[0].at(-1)).toBe('vencimientos');
    expect(ids(out)[1][0]).toBe('expedientes');
  });

  it('en los extremos absolutos no hace nada', () => {
    expect(moveItemByOffset(DEFAULT_LAYOUT.sections, 'kpis', -1)).toBe(DEFAULT_LAYOUT.sections);
    expect(moveItemByOffset(DEFAULT_LAYOUT.sections, 'calc', 1)).toBe(DEFAULT_LAYOUT.sections);
  });
});

describe('normalizeLayout (migración de layouts guardados)', () => {
  it('descarta widgets desconocidos y duplicados', () => {
    const saved = {
      version: 1,
      sections: [
        { id: 'resumen', title: 'Vista general', items: [{ t: 'w', id: 'kpis' }, { t: 'w', id: 'inexistente' }, { t: 'w', id: 'kpis' }] },
      ],
    };
    const out = normalizeLayout(saved);
    const all = flatItemOrder(out.sections).filter((x) => !x.startsWith('grp-'));
    expect(all.filter((x) => x === 'kpis').length).toBe(1);
    expect(all).not.toContain('inexistente');
  });

  it('disuelve grupos con un solo widget válido', () => {
    const saved = {
      version: 1,
      sections: [
        { id: 's', title: 'S', items: [{ t: 'g', id: 'g1', widgets: ['materia', 'fantasma'] }] },
      ],
    };
    const out = normalizeLayout(saved);
    expect(out.sections[0].items[0].t).toBe('w');
    expect(out.sections[0].items[0].id).toBe('materia');
  });

  it('reincorpora widgets nuevos del catálogo que falten (migración hacia adelante)', () => {
    const saved = {
      version: 1,
      sections: [{ id: 'solo', title: 'Solo', items: [{ t: 'w', id: 'kpis' }] }],
    };
    const out = normalizeLayout(saved);
    const all = ids(out.sections).flat();
    Object.keys(WIDGET_DEFS).forEach((id) => expect(all).toContain(id));
  });

  it('conserva userId y versión', () => {
    const out = normalizeLayout({ version: 1, userId: 'u1', sections: [] });
    expect(out.userId).toBe('u1');
    expect(out.version).toBe(1);
  });
});
