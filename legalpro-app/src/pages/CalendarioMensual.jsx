// legalpro-app/src/pages/CalendarioMensual.jsx
// Vista de CALENDARIO MENSUAL INTERACTIVO (LegalPro).
//
//   - Grid mensual 7 columnas L-D en CSS puro (sin librerías de calendario).
//   - Fuente de datos: misma que CalendarioVencimientos.jsx →
//     GET /api/plazos/vencimientos?dias=90 (vía nodeClient).
//     Si el endpoint falla o no devuelve datos → dataset DEMO generado desde
//     plazos-procesales comunes, cada ítem marcado demo:true.
//   - Drag & drop HTML5 nativo (solo desktop, puntero fino): al soltar llama
//     PATCH /api/plazos/vencimientos/:key { nueva_fecha_limite }. Ítems demo
//     solo cambian estado local + toast "Solo visual (endpoint pendiente)".
//   - Click en evento → panel lateral derecho (desktop ≥lg) / bottom sheet (móvil)
//     con detalle, [Exportar .ics] y [Ver expediente].
//   - Accesibilidad: aria-labels en nav, flechas ←/→ cambian mes con el grid
//     enfocado, touch targets ≥44px, Escape cierra panel, prefers-reduced-motion.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, ChevronLeft, ChevronRight, X, Download,
  FolderOpen, Filter, GripVertical, Info,
} from 'lucide-react';
import { nodeClient } from '../api/client';
import { useUI } from '../context/UIContext';

// ── Constantes ────────────────────────────────────────────────────────────────
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const FILTROS_MATERIA = [
  { value: 'todos', label: 'Todas las materias' },
  { value: 'penal', label: 'Penal' },
  { value: 'civil', label: 'Civil' },
  { value: 'laboral', label: 'Laboral' },
  { value: 'constitucional', label: 'Constitucional' },
  { value: 'tributario', label: 'Tributario' },
  { value: 'administrativo', label: 'Administrativo' },
];

// Color por materia (chip dentro de celda + punto en detalle).
const MATERIA_STYLE = {
  penal:          { label: 'Penal',          chip: 'bg-red-500/15 text-red-300 border-red-500/40',            dot: 'bg-red-400' },
  civil:          { label: 'Civil',          chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',         dot: 'bg-cyan-400' },
  laboral:        { label: 'Laboral',        chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',      dot: 'bg-amber-400' },
  constitucional: { label: 'Constitucional', chip: 'bg-violet-500/15 text-violet-300 border-violet-500/40',   dot: 'bg-violet-400' },
  tributario:     { label: 'Tributario',     chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  administrativo: { label: 'Administrativo', chip: 'bg-orange-500/15 text-orange-300 border-orange-500/40',   dot: 'bg-orange-400' },
  admin:          { label: 'Administrativo', chip: 'bg-orange-500/15 text-orange-300 border-orange-500/40',   dot: 'bg-orange-400' },
  default:        { label: 'General',        chip: 'bg-slate-500/15 text-slate-300 border-slate-500/40',      dot: 'bg-slate-400' },
};

const estiloMateria = (m) => MATERIA_STYLE[m] || MATERIA_STYLE.default;

// ── Utilidades puras ──────────────────────────────────────────────────────────
function ymd(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

/** Dataset demo: plazos procesales comunes (catalogs/plazos-procesales.json),
 *  distribuidos alrededor del mes actual. Cada ítem lleva demo:true. */
function generarDatosDemo() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const iso = (offsetDays) => {
    const d = new Date(y, m, 1 + offsetDays);
    return ymd(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const base = [
    { off: 2,  exp: '0450-2026', ev: 'contestacion_demanda', desc: 'Contestación de demanda',             mat: 'civil',          tit: 'Obra incompleta vs Constructora Andina S.A.C.', base: 'CPC Art. 449',       urg: 'ALTA' },
    { off: 5,  exp: '1288-2025', ev: 'requerimiento_fiscal', desc: 'Requerimiento del Ministerio Público', mat: 'penal',          tit: 'Ministerio Público vs Delgado Q.',              base: 'NCPP Art. 353',      urg: 'CRITICA' },
    { off: 8,  exp: '0312-2026', ev: 'demanda_amparo',       desc: 'Plazo para interponer amparo',         mat: 'constitucional', tit: 'Amparo contra Municipalidad de Surco',           base: 'CPConst Art. 46',    urg: 'MEDIA' },
    { off: 11, exp: '0977-2025', ev: 'demanda_laboral',      desc: 'Caducidad para demandar',              mat: 'laboral',        tit: 'Rojas M. vs Transportes Línea S.A.',             base: 'LPCL Art. 31',       urg: 'ALTA' },
    { off: 14, exp: '2210-2026', ev: 'reclamo_sunat',        desc: 'Reclamo ante SUNAT',                   mat: 'tributario',     tit: 'Carta inductiva IT-2026-8812',                   base: 'CT Art. 149',        urg: 'CRITICA' },
    { off: 17, exp: '0655-2026', ev: 'demanda_contenciosa',  desc: 'Demanda contencioso-administrativa',   mat: 'administrativo', tit: 'Impugnación de sanción OEFA',                    base: 'TUO L.27584 Art.19', urg: 'MEDIA' },
    { off: 20, exp: '0450-2026', ev: 'apelacion_sentencia',  desc: 'Apelación de sentencia',               mat: 'civil',          tit: 'Obra incompleta vs Constructora Andina S.A.C.',  base: 'CPC Art. 373',       urg: 'ALTA' },
    { off: 23, exp: '3391-2025', ev: 'acusacion',            desc: 'Acusación fiscal',                     mat: 'penal',          tit: 'Ministerio Público vs Salas V.',                 base: 'NCPP Art. 349',      urg: 'MEDIA' },
    { off: 26, exp: '2210-2026', ev: 'apelacion_tf',         desc: 'Apelación ante Tribunal Fiscal',       mat: 'tributario',     tit: 'Carta inductiva IT-2026-8812',                   base: 'CT Art. 155',        urg: 'BAJA' },
    { off: -3, exp: '0977-2025', ev: 'apelacion_resolucion', desc: 'Apelación de resolución',              mat: 'laboral',        tit: 'Rojas M. vs Transportes Línea S.A.',             base: 'LPCL Art. 39',       urg: 'BAJA' },
    { off: 33, exp: '0655-2026', ev: 'audiencia_unica',      desc: 'Audiencia única',                      mat: 'administrativo', tit: 'Impugnación de sanción OEFA',                    base: 'TUO L.27584',        urg: 'ALTA' },
  ];
  return base.map((p, i) => ({
    expediente_id: `demo-${String(i + 1).padStart(3, '0')}`,
    numero: `EXP-DEMO-${p.exp}`,
    evento: p.ev,
    evento_descripcion: p.desc,
    titulo: p.tit,
    materia: p.mat,
    tipo: p.mat,
    urgencia: p.urg,
    fecha_limite: iso(p.off),
    base_legal: p.base,
    demo: true,
  }));
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CalendarioMensual() {
  const { toast } = useUI();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fuenteDemo, setFuenteDemo] = useState(false);

  const [filtro, setFiltro] = useState('todos');
  const [overridesFecha, setOverridesFecha] = useState({}); // key → 'YYYY-MM-DD'
  const [seleccionado, setSeleccionado] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const [mesActual, setMesActual] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const dragKeyRef = useRef(null);
  const closeBtnRef = useRef(null);
  const sheetRef = useRef(null);
  const panelRef = useRef(null);

  // Drag & drop solo en dispositivos con puntero fino (desktop). En móvil se
  // oculta la affordance (grip/cursor) y los chips no son draggable.
  const [canDrag] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );

  // ── Fetch (misma fuente que CalendarioVencimientos.jsx) ────────────────────
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setLoading(true);
        const res = await nodeClient.get('/api/plazos/vencimientos', { params: { dias: 90 } });
        const data = res.data?.data?.vencimientos ?? res.data?.vencimientos ?? [];
        if (cancelado) return;
        if (Array.isArray(data) && data.length > 0) {
          setItems(data);
          setFuenteDemo(false);
        } else {
          setItems(generarDatosDemo());
          setFuenteDemo(true);
        }
      } catch {
        if (!cancelado) {
          setItems(generarDatosDemo());
          setFuenteDemo(true);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // ── Enriquecer + overrides locales ─────────────────────────────────────────
  const enriched = useMemo(() => items.map((v) => {
    const key = `${v.expediente_id}::${v.evento}`;
    const fechaEfectiva = overridesFecha[key] ?? v.fecha_limite;
    return {
      ...v,
      key,
      demo: !!v.demo,
      materia: (v.materia || v.tipo || 'general').toLowerCase(),
      fechaEfectiva,
    };
  }), [items, overridesFecha]);

  const filtrados = useMemo(
    () => enriched.filter((v) => filtro === 'todos' || v.materia === filtro),
    [enriched, filtro]
  );

  const porDia = useMemo(() => {
    const map = {};
    filtrados.forEach((v) => {
      if (!v.fechaEfectiva) return;
      (map[v.fechaEfectiva] ||= []).push(v);
    });
    return map;
  }, [filtrados]);

  // ── Celdas del grid (incluye días de meses adyacentes, atenuados) ──────────
  const celdas = useMemo(() => {
    const { year, month } = mesActual;
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
    const diasMes = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((firstDow + diasMes) / 7) * 7;
    const arr = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(year, month, 1 - firstDow + i);
      arr.push({
        dia: d.getDate(),
        fechaStr: ymd(d.getFullYear(), d.getMonth(), d.getDate()),
        enMes: d.getMonth() === month,
      });
    }
    return arr;
  }, [mesActual]);

  const nombreMes = new Date(mesActual.year, mesActual.month).toLocaleDateString('es-PE', {
    month: 'long', year: 'numeric',
  });

  const hoyStr = (() => {
    const d = new Date();
    return ymd(d.getFullYear(), d.getMonth(), d.getDate());
  })();

  // ── Navegación de mes ──────────────────────────────────────────────────────
  const cambiarMes = useCallback((delta) => {
    setMesActual((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  }, []);

  const irHoy = useCallback(() => {
    const d = new Date();
    setMesActual({ year: d.getFullYear(), month: d.getMonth() });
  }, []);

  // Teclado: flechas ←/→ cambian de mes cuando el grid tiene foco.
  const onGridKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); cambiarMes(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); cambiarMes(1); }
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragStart = (e, key) => {
    dragKeyRef.current = key;
    try { e.dataTransfer.setData('text/plain', key); } catch { /* Firefox */ }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCell = (e, fechaStr) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== fechaStr) setDropTarget(fechaStr);
  };

  const handleDropCell = async (e, fechaStr) => {
    e.preventDefault();
    setDropTarget(null);
    const key = dragKeyRef.current || e.dataTransfer.getData('text/plain');
    dragKeyRef.current = null;
    if (!key) return;

    const item = enriched.find((v) => v.key === key);
    if (!item || item.fechaEfectiva === fechaStr) return;

    // Optimista: actualizar estado local siempre.
    setOverridesFecha((prev) => ({ ...prev, [key]: fechaStr }));

    // Ítems demo: sin backend → solo visual.
    if (item.demo) {
      toast.info(`Solo visual (endpoint pendiente) — "${item.evento_descripcion}" movida a ${formatFecha(fechaStr)}.`, { duration: 4500 });
      return;
    }

    // Endpoint real: PATCH /api/plazos/vencimientos/:key { nueva_fecha_limite }
    try {
      await nodeClient.patch(
        `/api/plazos/vencimientos/${encodeURIComponent(key)}`,
        { nueva_fecha_limite: fechaStr }
      );
      toast.success(`Vencimiento movido a ${formatFecha(fechaStr)}.`, { duration: 3500 });
    } catch (err) {
      // Rollback del cambio optimista.
      setOverridesFecha((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.error(`No se pudo mover el vencimiento${err?.response?.status ? ` (HTTP ${err.response.status})` : ''}. Se revirtió el cambio.`, { duration: 5000 });
    }
  };

  // ── Detalle (panel lateral / bottom sheet) ─────────────────────────────────
  const abrirDetalle = useCallback((v) => setSeleccionado(v), []);
  const cerrarDetalle = useCallback(() => setSeleccionado(null), []);

  // Foco inicial + Escape + trampa de Tab ligera en el panel abierto.
  useEffect(() => {
    if (!seleccionado) return undefined;
    closeBtnRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { cerrarDetalle(); return; }
      const panel = panelRef.current || sheetRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const foco = panel.querySelectorAll('button, a[href]');
      if (foco.length === 0) return;
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [seleccionado, cerrarDetalle]);

  // ── Exportar .ics (evento individual) ──────────────────────────────────────
  const [exportando, setExportando] = useState(false);
  const descargarBlob = (blob, nombre) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportarIcs = async () => {
    if (!seleccionado || exportando) return;
    const v = seleccionado;
    setExportando(true);
    try {
      if (v.demo) {
        // Demo: generar .ics mínimo en cliente (sin llamar al backend).
        const dt = v.fechaEfectiva.replaceAll('-', '');
        const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
        const ics = [
          'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LegalPro//Calendario Mensual//ES',
          'BEGIN:VEVENT',
          `UID:${v.key}@legalpro`,
          `DTSTART;VALUE=DATE:${dt}`,
          `SUMMARY:${esc(`${v.numero} — ${v.evento_descripcion}`)}`,
          `DESCRIPTION:${esc(`Expediente: ${v.numero} — ${v.titulo}${v.base_legal ? ` · ${v.base_legal}` : ''}`)}`,
          'END:VEVENT', 'END:VCALENDAR',
        ].join('\r\n');
        descargarBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'vencimiento-demo.ics');
        toast.info('Archivo .ics demo descargado (generado en cliente).', { duration: 3500 });
      } else {
        const res = await nodeClient.post(
          '/api/herramientas/exportar-ics',
          { eventos: [{
            titulo: `${v.numero} — ${v.evento_descripcion}`.slice(0, 200),
            fecha: v.fechaEfectiva,
            descripcion: `Expediente: ${v.numero} — ${v.titulo}${v.base_legal ? ` · ${v.base_legal}` : ''}`.slice(0, 500),
          }] },
          { responseType: 'blob' }
        );
        descargarBlob(new Blob([res.data], { type: 'text/calendar;charset=utf-8' }), 'vencimiento-legalpro.ics');
        toast.success('Evento exportado a .ics.', { duration: 3000 });
      }
    } catch {
      toast.error('No se pudo generar el archivo .ics.');
    } finally {
      setExportando(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-cyan-400" aria-hidden="true" />
            Calendario Mensual
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Vencimientos procesales en vista mensual. Arrastra un evento a otro día para re-agendar
            {canDrag ? '' : ' (disponible en desktop)'}.
          </p>
        </div>

        {/* Navegación de mes */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="px-4 h-11 inline-flex items-center justify-center bg-white/5 rounded-lg border border-white/10 min-w-[170px] capitalize text-white text-sm font-medium" aria-live="polite">
            {nombreMes}
          </div>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={irHoy}
            aria-label="Ir al mes actual"
            className="h-11 px-4 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Filtros + aviso demo */}
      <div className="flex flex-wrap gap-3 items-center bg-white/5 rounded-lg p-3 border border-white/10">
        <label htmlFor="filtro-materia-cal" className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" aria-hidden="true" />
          Materia:
        </label>
        <select
          id="filtro-materia-cal"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="h-11 sm:h-auto bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
        >
          {FILTROS_MATERIA.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {fuenteDemo && !loading && (
          <span className="ml-auto inline-flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-1.5">
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            Datos demo — endpoint de vencimientos no disponible o sin resultados.
          </span>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-400" role="status" aria-live="polite">
          Cargando calendario…
        </div>
      )}

      {!loading && (
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── Grid mensual (CSS puro, 7 columnas L-D) ── */}
        <div className="flex-1 min-w-0 bg-white/5 rounded-xl border border-white/10 p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS_SEMANA.map((d) => (
              <div key={d} role="columnheader" className="text-center text-xs text-slate-400 font-medium py-2">
                {d}
              </div>
            ))}
          </div>
          <div
            role="grid"
            tabIndex={0}
            aria-label={`Calendario mensual de vencimientos, ${nombreMes}. Usa las flechas izquierda y derecha para cambiar de mes.`}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            {celdas.map((c) => {
              const eventos = porDia[c.fechaStr] || [];
              const esHoy = c.fechaStr === hoyStr;
              const esDrop = dropTarget === c.fechaStr;

              const estiloCelda = esDrop
                ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/60'
                : esHoy
                  ? 'bg-slate-800/60 border-slate-600'
                  : 'bg-slate-900/40 border-white/10';

              return (
                <div
                  key={c.fechaStr}
                  role="gridcell"
                  aria-label={`${c.fechaStr}, ${eventos.length} vencimiento${eventos.length === 1 ? '' : 's'}${esHoy ? ', hoy' : ''}${c.enMes ? '' : ', de otro mes'}`}
                  onDragOver={(e) => handleDragOverCell(e, c.fechaStr)}
                  onDragLeave={() => { if (dropTarget === c.fechaStr) setDropTarget(null); }}
                  onDrop={(e) => handleDropCell(e, c.fechaStr)}
                  className={`min-h-[96px] sm:min-h-[112px] rounded border p-1.5 text-left transition-colors ${estiloCelda} ${c.enMes ? '' : 'opacity-40'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      aria-current={esHoy ? 'date' : undefined}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                        esHoy
                          ? 'bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-400'
                          : c.enMes ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {c.dia}
                    </span>
                    {eventos.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                        {eventos.length}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {eventos.slice(0, 3).map((v) => {
                      const st = estiloMateria(v.materia);
                      return (
                        <li key={v.key}>
                          <button
                            type="button"
                            draggable={canDrag}
                            onDragStart={(e) => handleDragStart(e, v.key)}
                            onDragEnd={() => { dragKeyRef.current = null; setDropTarget(null); }}
                            onClick={() => abrirDetalle(v)}
                            title={`${v.numero} — ${v.evento_descripcion} (${formatFecha(v.fechaEfectiva)})`}
                            aria-label={`Ver detalle: ${v.numero}, ${v.evento_descripcion}, ${formatFecha(v.fechaEfectiva)}${canDrag ? '. Arrastrable a otro día' : ''}`}
                            className={`group w-full min-h-[44px] flex flex-col justify-center text-left rounded px-1.5 py-1 border hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${st.chip} ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                          >
                            <span className="flex items-center gap-1 min-w-0">
                              {canDrag && (
                                <GripVertical className="hidden md:block w-3 h-3 opacity-50 group-hover:opacity-100 flex-shrink-0" aria-hidden="true" />
                              )}
                              <span className="truncate text-[11px] font-semibold leading-tight">
                                {v.numero || v.expediente_id}
                              </span>
                            </span>
                            <span className="truncate text-[10px] leading-tight text-slate-300/90">
                              {v.evento_descripcion}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {eventos.length > 3 && (
                      <li className="text-[10px] text-slate-400 pl-1" aria-label={`${eventos.length - 3} vencimientos más este día`}>
                        +{eventos.length - 3} más
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Leyenda de materias */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-3">
            {['penal', 'civil', 'laboral', 'constitucional', 'tributario', 'administrativo'].map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5 capitalize">
                <span className={`w-2.5 h-2.5 rounded-full ${estiloMateria(m).dot}`} aria-hidden="true" />
                {estiloMateria(m).label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Panel lateral derecho (desktop ≥lg) ── */}
        <aside
        ref={panelRef}
        aria-label="Detalle del vencimiento seleccionado"
        style={{ minHeight: '280px' }}
        className={`hidden lg:flex lg:w-80 xl:w-96 flex-shrink-0 self-start sticky top-4 rounded-xl border p-4 flex-col gap-3 ${
          seleccionado
            ? 'bg-slate-900 border-white/15'
            : 'bg-white/5 border-white/10 items-center justify-center text-center'
        }`}
      >
        {!seleccionado ? (
          <>
            <CalendarDays className="w-10 h-10 text-slate-600" aria-hidden="true" />
            <p className="text-sm text-slate-500">
              Selecciona un evento del calendario para ver su detalle.
            </p>
          </>
        ) : (
          <DetalleEvento
            v={seleccionado}
            exportando={exportando}
            onExportarIcs={exportarIcs}
            onClose={cerrarDetalle}
            closeBtnRef={closeBtnRef}
          />
        )}
      </aside>
      </div>
      )}

      {/* ── Bottom sheet (móvil <lg) ── */}
      {seleccionado && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={cerrarDetalle}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Detalle del vencimiento"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/15 bg-slate-900 p-4 pb-8 shadow-2xl"
          >
            <DetalleEvento
              v={seleccionado}
              exportando={exportando}
              onExportarIcs={exportarIcs}
              onClose={cerrarDetalle}
              closeBtnRef={closeBtnRef}
            />
          </div>
        </div>
      )}

      {/* Disclaimer legal */}
      <div className="text-xs text-slate-500 border-t border-white/5 pt-4">
        <strong className="text-slate-400">Disclaimer:</strong> Vencimientos calculados por el backend
        (<code className="mx-1 px-1 py-0.5 bg-white/5 rounded">GET /api/plazos/vencimientos</code>) según
        <code className="mx-1 px-1 py-0.5 bg-white/5 rounded">catalogs/plazos-procesales.json</code>.
        El re-agendamiento por drag &amp; drop persiste vía
        <code className="mx-1 px-1 py-0.5 bg-white/5 rounded">PATCH /api/plazos/vencimientos/:key</code>;
        los ítems demo son solo visuales. Verifica contra el texto oficial (SPIJ). No constituye asesoría legal.
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

/** Detalle del evento: panel lateral (desktop) y bottom sheet (móvil). */
function DetalleEvento({ v, exportando, onExportarIcs, onClose, closeBtnRef }) {
  const st = estiloMateria(v.materia);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full border ${st.chip}`}>
          <span className={`w-2 h-2 rounded-full ${st.dot}`} aria-hidden="true" />
          {st.label}
          {v.demo && (
            <span className="text-[10px] uppercase tracking-wide text-slate-400">(demo)</span>
          )}
        </span>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <h2 className="text-lg font-semibold text-white leading-snug">
        {v.numero} — {v.evento_descripcion}
      </h2>

      <dl className="text-sm space-y-1.5">
        <div className="flex gap-2">
          <dt className="text-slate-500 w-24 flex-shrink-0">Fecha</dt>
          <dd className="text-slate-200 capitalize">{formatFecha(v.fechaEfectiva)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500 w-24 flex-shrink-0">Materia</dt>
          <dd className={`capitalize ${v.demo ? 'text-slate-300' : 'text-slate-200'}`}>{st.label}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500 w-24 flex-shrink-0">Expediente</dt>
          <dd className="text-slate-200 break-all">
            {v.numero || v.expediente_id}
            {!v.demo && (
              <code className="ml-2 text-[10px] px-1 py-0.5 bg-white/5 rounded text-slate-400">
                {String(v.expediente_id).slice(0, 8)}…
              </code>
            )}
          </dd>
        </div>
        {v.titulo && (
          <div className="flex gap-2">
            <dt className="text-slate-500 w-24 flex-shrink-0">Caso</dt>
            <dd className="text-slate-300">{v.titulo}</dd>
          </div>
        )}
        {v.base_legal && (
          <div className="flex gap-2">
            <dt className="text-slate-500 w-24 flex-shrink-0">Base legal</dt>
            <dd><code className="text-xs px-1 py-0.5 bg-white/5 rounded text-cyan-300/90">{v.base_legal}</code></dd>
          </div>
        )}
      </dl>

      {/* Acciones (touch targets ≥44px) */}
      <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2 mt-auto pt-3">
        <button
          type="button"
          onClick={onExportarIcs}
          disabled={exportando}
          aria-label={`Exportar ${v.numero} a calendario .ics`}
          className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {exportando ? 'Exportando…' : 'Exportar .ics'}
        </button>
        {v.demo ? (
          <button
            type="button"
            disabled
            title="Los eventos demo no tienen expediente real."
            aria-label="Ver expediente no disponible para eventos demo"
            className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-sm cursor-not-allowed"
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            Ver expediente
          </button>
        ) : (
          <Link
            to={`/expediente/${v.expediente_id}`}
            onClick={onClose}
            aria-label={`Abrir expediente ${v.numero}`}
            className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            Ver expediente
          </Link>
        )}
      </div>
    </>
  );
}
