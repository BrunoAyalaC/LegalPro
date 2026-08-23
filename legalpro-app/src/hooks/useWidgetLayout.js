import { useCallback, useMemo, useState } from 'react';

/**
 * useWidgetLayout — persiste el orden y agrupación de widgets del Dashboard
 * en localStorage, con clave por versión global y aislamiento por usuario.
 *
 * Modelo de datos:
 *   Layout = { version, userId, sections: Section[] }
 *   Section = { id, title, items: Item[] }
 *   Item    = { t:'w', id }                        → widget suelto
 *           | { t:'g', id, widgets:[wid], collapsed }  → grupo colapsable con pestañas
 *
 * Clave de storage: legalpro_dash_layout_v1 (el userId va DENTRO del payload;
 * si no coincide con el usuario activo se ignora y se usa el layout default).
 *
 * Las transformaciones sobre sections son funciones PURAS exportadas
 * (testeables sin React); el hook solo las conecta al estado + storage.
 */

export const LAYOUT_STORAGE_KEY = 'legalpro_dash_layout_v1';
export const LAYOUT_VERSION = 1;

/** Catálogo canónico de widgets del Dashboard V2 */
export const WIDGET_DEFS = {
  kpis:         { title: 'Métricas clave',        span: 'sm:col-span-2 xl:col-span-3' },
  actividad:    { title: 'Carga procesal',        span: 'sm:col-span-2 xl:col-span-2' },
  expedientes:  { title: 'Expedientes recientes', span: '' },
  vencimientos: { title: 'Próximos vencimientos', span: '' },
  materia:      { title: 'Distribución por materia', span: '' },
  sinoe:        { title: 'Monitor SINOE',         span: '' },
  creditos:     { title: 'Créditos IA',           span: '' },
  calc:         { title: 'Herramientas CALC',     span: '' },
};

export const DEFAULT_LAYOUT = Object.freeze({
  version: LAYOUT_VERSION,
  sections: [
    {
      id: 'resumen',
      title: 'Vista general',
      items: [
        { t: 'w', id: 'kpis' },
        { t: 'w', id: 'actividad' },
        { t: 'w', id: 'vencimientos' },
        { t: 'w', id: 'expedientes' },
      ],
    },
    {
      id: 'analisis',
      title: 'Análisis y recursos',
      items: [
        { t: 'w', id: 'materia' },
        { t: 'w', id: 'sinoe' },
        { t: 'w', id: 'creditos' },
        { t: 'w', id: 'calc' },
      ],
    },
  ],
});

let groupSeq = 0;
const newGroupId = () => `grp-${Date.now().toString(36)}-${(groupSeq++).toString(36)}`;

/* ══════════════ Transformaciones puras sobre sections ══════════════ */

/** Localiza un item por id → { sectionIdx, itemIdx, item } | null */
export function locateItem(sections, itemId) {
  for (let s = 0; s < sections.length; s++) {
    const idx = sections[s].items.findIndex((it) => it.id === itemId);
    if (idx !== -1) return { sectionIdx: s, itemIdx: idx, item: sections[s].items[idx] };
  }
  return null;
}

/** Orden plano de todos los items (widgets y grupos), para mover con ↑↓ */
export function flatItemOrder(sections) {
  return sections.flatMap((s) => s.items.map((it) => it.id));
}

/**
 * Quita un widget de donde esté (suelto o dentro de un grupo).
 * Si el grupo queda con ≤1 widget se disuelve en widget suelto.
 */
export function extractWidget(sections, widgetId) {
  return sections.map((sec) => ({
    ...sec,
    items: sec.items.flatMap((item) => {
      if (item.t === 'w' && item.id === widgetId) return [];
      if (item.t === 'g' && item.widgets.includes(widgetId)) {
        const widgets = item.widgets.filter((w) => w !== widgetId);
        if (widgets.length <= 1) return widgets.map((w) => ({ t: 'w', id: w }));
        return [{ ...item, widgets }];
      }
      return [item];
    }),
  }));
}

/**
 * Inserta un widget suelto en una sección.
 * Con anchorId+position ('before'|'after') lo sitúa relativo a otro item;
 * la búsqueda del anchor se hace SOBRE la lista ya extraída, por lo que el
 * corrimiento de índices tras retirar el widget arrastrado es automático.
 * Sin anchor → append al final. Devuelve sections nuevas (o las mismas).
 */
export function insertWidget(sections, widgetId, sectionId, anchorId = null, position = 'after') {
  const extracted = extractWidget(sections, widgetId);
  const target = extracted.find((s) => s.id === sectionId);
  if (!target) return sections;
  let at = target.items.length;
  if (anchorId) {
    const ai = target.items.findIndex((it) => it.id === anchorId);
    if (ai !== -1) at = ai + (position === 'after' ? 1 : 0);
  }
  return extracted.map((s) => {
    if (s.id !== sectionId) return s;
    const items = [...s.items];
    items.splice(Math.min(at, items.length), 0, { t: 'w', id: widgetId });
    return { ...s, items };
  });
}

/**
 * Soltar un widget SOBRE otro item:
 * - sobre un widget suelto → crea un grupo nuevo con ambos, en esa posición
 * - sobre un grupo         → se une al grupo existente
 */
export function joinOrCreateGroup(sections, dragWidgetId, targetItemId) {
  if (dragWidgetId === targetItemId) return sections;
  const loc = locateItem(sections, targetItemId);
  if (!loc) return sections;
  const target = loc.item;
  const withoutDrag = extractWidget(sections, dragWidgetId);

  if (target.t === 'g') {
    if (target.widgets.includes(dragWidgetId)) return sections;
    return withoutDrag.map((sec) => ({
      ...sec,
      items: sec.items.map((it) =>
        it.id === targetItemId ? { ...it, widgets: [...it.widgets, dragWidgetId] } : it,
      ),
    }));
  }

  // target es widget suelto → grupo nuevo en la misma posición
  const groupId = newGroupId();
  return withoutDrag.map((sec) => ({
    ...sec,
    items: sec.items.flatMap((it) =>
      it.id === targetItemId
        ? [{ t: 'g', id: groupId, widgets: [target.id, dragWidgetId], collapsed: false }]
        : [it],
    ),
  }));
}

/** Extrae un widget de un grupo (queda como widget suelto justo después). */
export function ungroupOne(sections, groupId, widgetId) {
  const loc = locateItem(sections, groupId);
  if (!loc || loc.item.t !== 'g' || !loc.item.widgets.includes(widgetId)) return sections;
  return sections.map((sec, i) => {
    if (i !== loc.sectionIdx) return sec;
    const items = sec.items.flatMap((it) => {
      if (it.id !== groupId) return [it];
      const rest = it.widgets.filter((w) => w !== widgetId);
      const head = rest.length >= 2 ? [{ ...it, widgets: rest }] : rest.map((w) => ({ t: 'w', id: w }));
      return [...head, { t: 'w', id: widgetId }];
    });
    return { ...sec, items };
  });
}

/** Mueve un item ±1 posición en el orden plano (cruza secciones en los bordes). */
export function moveItemByOffset(sections, itemId, delta) {
  const order = flatItemOrder(sections);
  const from = order.indexOf(itemId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= order.length || from === to) return sections;

  const locFrom = locateItem(sections, itemId);
  const targetId = order[to];
  const locTo = locateItem(sections, targetId);

  // Misma sección → swap simple
  if (locFrom.sectionIdx === locTo.sectionIdx) {
    return sections.map((sec, i) => {
      if (i !== locFrom.sectionIdx) return sec;
      const items = [...sec.items];
      const a = items.findIndex((it) => it.id === itemId);
      const b = items.findIndex((it) => it.id === targetId);
      [items[a], items[b]] = [items[b], items[a]];
      return { ...sec, items };
    });
  }

  // Cruza secciones → retirar e insertar al inicio/fin de la sección destino
  const removed = sections.map((sec) =>
    sec.id === sections[locFrom.sectionIdx].id
      ? { ...sec, items: sec.items.filter((it) => it.id !== itemId) }
      : sec,
  );
  const insertAt = delta > 0 ? 0 : removed[locTo.sectionIdx].items.length;
  return removed.map((sec, i) => {
    if (i !== locTo.sectionIdx) return sec;
    const items = [...sec.items];
    items.splice(insertAt, 0, locFrom.item);
    return { ...sec, items };
  });
}

/**
 * Normaliza un layout guardado contra el catálogo actual:
 * - descarta ids desconocidos, grupos vacíos y duplicados
 * - disuelve grupos que quedaron con un solo widget
 * - añade al final los widgets nuevos que falten (migraciones seguras)
 */
export function normalizeLayout(saved) {
  const seen = new Set();
  const sections = (saved?.sections ?? [])
    .filter((s) => s && Array.isArray(s.items))
    .map((s, i) => ({
      id: typeof s.id === 'string' ? s.id : `sec-${i}`,
      title: typeof s.title === 'string' ? s.title : `Sección ${i + 1}`,
      items: s.items.flatMap((item) => {
        if (item?.t === 'g' && Array.isArray(item.widgets)) {
          const widgets = item.widgets.filter((w) => WIDGET_DEFS[w] && !seen.has(w));
          widgets.forEach((w) => seen.add(w));
          if (widgets.length === 0) return [];
          if (widgets.length === 1) return [{ t: 'w', id: widgets[0] }];
          return [{ t: 'g', id: item.id || newGroupId(), widgets, collapsed: !!item.collapsed }];
        }
        const id = item?.t === 'w' ? item.id : item?.id;
        if (!WIDGET_DEFS[id] || seen.has(id)) return [];
        seen.add(id);
        return [{ t: 'w', id }];
      }),
    }))
    .filter((s) => s.items.length > 0);

  // Widgets del catálogo ausentes en el layout guardado → al final de la última sección
  const missing = Object.keys(WIDGET_DEFS).filter((id) => !seen.has(id));
  if (missing.length) {
    if (sections.length === 0) sections.push({ ...DEFAULT_LAYOUT.sections[0], items: [] });
    sections[sections.length - 1].items.push(...missing.map((id) => ({ t: 'w', id })));
  }
  return { version: LAYOUT_VERSION, userId: saved?.userId ?? null, sections };
}

/* ══════════════ Persistencia ══════════════ */

function readStorage() {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== LAYOUT_VERSION || !Array.isArray(parsed.sections)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(layout) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* cuota llena o storage bloqueado: el layout vive solo en memoria */
  }
}

/* ══════════════ Hook ══════════════ */

export function useWidgetLayout(userId) {
  const [layout, setLayout] = useState(() => {
    const stored = readStorage();
    if (stored && userId && stored.userId === userId) return normalizeLayout(stored);
    return { ...DEFAULT_LAYOUT, userId: userId ?? null };
  });
  const [isCustomized, setIsCustomized] = useState(() => {
    const stored = readStorage();
    return !!(stored && userId && stored.userId === userId);
  });

  // Sincroniza con cambio de usuario (login/logout) usando el patrón
  // "ajustar estado durante el render" recomendado por React — sin effects.
  const [prevUserId, setPrevUserId] = useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    const stored = readStorage();
    if (stored && userId && stored.userId === userId) {
      setLayout(normalizeLayout(stored));
      setIsCustomized(true);
    } else {
      setLayout({ ...DEFAULT_LAYOUT, userId: userId ?? null });
      setIsCustomized(false);
    }
  }

  const commit = useCallback((transform) => {
    setLayout((prev) => {
      const sections = transform(prev.sections);
      if (sections === prev.sections) return prev;
      const next = { ...prev, sections };
      writeStorage(next);
      return next;
    });
    setIsCustomized(true);
  }, []);

  /** Reordena: inserta relativo a un anchor dentro de una sección */
  const moveWidget = useCallback(
    (widgetId, sectionId, anchorId = null, position = 'after') => {
      commit((sections) => insertWidget(sections, widgetId, sectionId, anchorId, position));
    },
    [commit],
  );

  /** Soltar un widget SOBRE otro item → agrupa */
  const dropOnItem = useCallback(
    (dragWidgetId, targetItemId) => {
      commit((sections) => joinOrCreateGroup(sections, dragWidgetId, targetItemId));
    },
    [commit],
  );

  /** Extrae un widget de un grupo */
  const ungroupWidget = useCallback(
    (groupId, widgetId) => {
      commit((sections) => ungroupOne(sections, groupId, widgetId));
    },
    [commit],
  );

  /** Mueve un item ±1 posición (botones ↑↓, móvil y teclado) */
  const moveByOffset = useCallback(
    (itemId, delta) => {
      commit((sections) => moveItemByOffset(sections, itemId, delta));
    },
    [commit],
  );

  const toggleGroupCollapsed = useCallback(
    (groupId) => {
      commit((sections) =>
        sections.map((s) => ({
          ...s,
          items: s.items.map((it) => (it.id === groupId ? { ...it, collapsed: !it.collapsed } : it)),
        })),
      );
    },
    [commit],
  );

  // Selección de pestaña: estado efímero de UI, no se persiste
  const setGroupTab = useCallback((groupId, tabIndex) => {
    setLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        items: s.items.map((it) => (it.id === groupId ? { ...it, activeTab: tabIndex } : it)),
      })),
    }));
  }, []);

  /** Restaura el layout default y limpia storage */
  const resetLayout = useCallback(() => {
    try {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch { /* noop */ }
    setLayout({ ...DEFAULT_LAYOUT, userId: layout.userId });
    setIsCustomized(false);
  }, [layout.userId]);

  const stats = useMemo(() => {
    const widgets = new Set();
    let groups = 0;
    layout.sections.forEach((s) =>
      s.items.forEach((it) => {
        if (it.t === 'g') {
          groups += 1;
          it.widgets.forEach((w) => widgets.add(w));
        } else {
          widgets.add(it.id);
        }
      }),
    );
    return { totalWidgets: widgets.size, groups };
  }, [layout]);

  return {
    sections: layout.sections,
    isCustomized,
    moveWidget,
    dropOnItem,
    ungroupWidget,
    moveByOffset,
    toggleGroupCollapsed,
    setGroupTab,
    resetLayout,
    stats,
  };
}

export default useWidgetLayout;
