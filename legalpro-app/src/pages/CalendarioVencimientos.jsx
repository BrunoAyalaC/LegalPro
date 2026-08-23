// legalpro-app/src/pages/CalendarioVencimientos.jsx
// Calendario editable de vencimientos procesales (LegalPro).
//
// Mejoras v2 (Agosto 2026):
//   - Consume el endpoint backend GET /api/plazos/vencimientos (single source of truth).
//   - Feriados: lee de utils/feriadosPeru.js (sincronizado a catalogs/feriados-peru.json).
//     NO hay feriados hardcoded en este archivo.
//   - Drag & drop NATIVO HTML5 (sin librerías pesadas) para mover un vencimiento a otra
//     fecha. Como el backend AÚN no expone endpoint para actualizar la fecha_limite
//     de un vencimiento calculado, el cambio se aplica a estado local y se muestra
//     un toast informativo. Cuando el endpoint exista, solo hay que cambiar el bloque
//     marcado con `// TODO-BACKEND:`.
//   - Drop = "Marcar completado": mueve el item a la lista "Completados" del mes.
//     Persistencia local (estado React). En el futuro, si se requiere persistir en BD,
//     exponer un endpoint que reciba el id del vencimiento calculado (no aplica a
//     `PATCH /api/notificaciones/:id/leida` porque este solo cubre notificaciones SINOE).
//   - Filtro por materia ya existía — se conserva y se conecta al filtro de UI.
//   - Responsividad: grid mensual responsive + flex-wrap en header.
//   - Lazy-loading: ya está en App.jsx (línea 39).
//   - Accesibilidad: aria-labels, role="button" en celdas drop-target, focus visible.

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle,
  Clock, FileText, Bell, Filter, CheckCircle2, GripVertical,
  Download,
} from 'lucide-react';
import { nodeClient } from '../api/client';
import { useUI } from '../context/UIContext';
import { esDiaHabil, getNombreFeriado } from '../utils/feriadosPeru';

// ── Constantes de UI ──────────────────────────────────────────────────────────
const MATERIAS = [
  { value: 'todos',          label: 'Todas las materias' },
  { value: 'civil',          label: 'Civil' },
  { value: 'penal',          label: 'Penal' },
  { value: 'laboral',        label: 'Laboral' },
  { value: 'constitucional', label: 'Constitucional' },
  { value: 'familia',        label: 'Familia' },
  { value: 'comercial',      label: 'Comercial' },
  { value: 'administrativo', label: 'Administrativo' },
];

const URGENCIA_STYLE = {
  CRITICA: { label: 'CRÍTICA', bg: 'bg-red-500/15',     text: 'text-red-400',     icon: '⚠️' },
  ALTA:    { label: 'ALTA',    bg: 'bg-amber-500/15',   text: 'text-amber-400',   icon: '⏰' },
  MEDIA:   { label: 'MEDIA',   bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  icon: '⏳' },
  BAJA:    { label: 'BAJA',    bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: '✓' },
  SIN_FECHA: { label: 'Sin fecha', bg: 'bg-slate-500/15', text: 'text-slate-400', icon: '—' },
};

// ── Utilidades locales (puras, sin estado) ────────────────────────────────────
function formatFecha(str) {
  if (!str) return '—';
  // El backend entrega YYYY-MM-DD; parseamos en local para evitar shift por timezone.
  const d = new Date(str + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function ymd(year, month, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function diasHasta(fechaVencimientoStr) {
  if (!fechaVencimientoStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimientoStr + 'T00:00:00');
  if (Number.isNaN(venc.getTime())) return null;
  return Math.round((venc - hoy) / 86_400_000);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CalendarioVencimientos() {
  const { toast } = useUI();

  // Datos crudos del backend
  const [vencimientos, setVencimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Overrides locales (drag & drop) — clave = `${expediente_id}::${evento}`
  const [overridesFecha, setOverridesFecha] = useState({}); // { key: 'YYYY-MM-DD' }
  const [overridesCompletado, setOverridesCompletado] = useState({}); // { key: true }

  // Filtros
  const [filtroMateria, setFiltroMateria] = useState('todos');
  const [mostrarCompletados, setMostrarCompletados] = useState(true);

  // Mes visible en el grid
  const [mesActual, setMesActual] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // DnD refs (estado de drag en curso)
  const dragKeyRef = useRef(null);
  const [dropTarget, setDropTarget] = useState(null); // 'YYYY-MM-DD' | null

  // Exportación .ics (POST /api/herramientas/exportar-ics)
  const [exportando, setExportando] = useState(false);
  const [exportError, setExportError] = useState(null);

  // ── Carga inicial desde backend ──────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setLoading(true);
        // Pedimos ventana amplia (90d, máximo permitido por el endpoint) para
        // dar margen al usuario a explorar próximos vencimientos.
        const res = await nodeClient.get('/api/plazos/vencimientos', { params: { dias: 90 } });
        const data = res.data?.data?.vencimientos ?? res.data?.vencimientos ?? [];
        if (!cancelado) setVencimientos(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelado) setError(e?.response?.data?.error || e.message || 'Error al cargar vencimientos');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // ── Enriquecer vencimientos con overrides y diff calculado ───────────────────
  const enriched = useMemo(() => {
    return vencimientos.map(v => {
      const key = `${v.expediente_id}::${v.evento}`;
      const fechaEfectiva = overridesFecha[key] ?? v.fecha_limite;
      const completado = !!overridesCompletado[key];
      return {
        ...v,
        key,
        materia: (v.materia || v.tipo || 'general').toLowerCase(),
        fechaEfectiva,
        diff: diasHasta(fechaEfectiva),
        completado,
      };
    });
  }, [vencimientos, overridesFecha, overridesCompletado]);

  // ── Filtro por materia ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return enriched.filter(v => filtroMateria === 'todos' || v.materia === filtroMateria);
  }, [enriched, filtroMateria]);

  // ── Agrupación por día (YYYY-MM-DD) para colorear celdas y grid ─────────────
  const byDay = useMemo(() => {
    const map = {};
    filtered.forEach(v => {
      if (!v.fechaEfectiva) return;
      if (v.completado && !mostrarCompletados) return;
      (map[v.fechaEfectiva] ||= []).push(v);
    });
    return map;
  }, [filtered, mostrarCompletados]);

  // ── Días del mes actual (relleno con nulls para alinear) ────────────────────
  const gridDays = useMemo(() => {
    const firstDow = new Date(mesActual.year, mesActual.month, 1).getDay();
    const total = daysInMonth(mesActual.year, mesActual.month);
    const arr = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    return arr;
  }, [mesActual]);

  // ── Listado del mes (vista alternativa para ver detalle completo) ───────────
  const mesActualKey = `${mesActual.year}-${String(mesActual.month + 1).padStart(2, '0')}`;
  const delMes = useMemo(
    () => filtered
      .filter(v => v.fechaEfectiva && v.fechaEfectiva.startsWith(mesActualKey))
      .filter(v => mostrarCompletados || !v.completado)
      .sort((a, b) => (a.fechaEfectiva || '').localeCompare(b.fechaEfectiva || '')),
    [filtered, mesActualKey, mostrarCompletados]
  );

  const completadosDelMes = useMemo(
    () => delMes.filter(v => v.completado),
    [delMes]
  );
  const pendientesDelMes = useMemo(
    () => delMes.filter(v => !v.completado),
    [delMes]
  );

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activos = enriched.filter(v => !v.completado);
    return {
      vencidos:  activos.filter(v => v.diff !== null && v.diff < 0).length,
      criticos:  activos.filter(v => v.urgencia === 'CRITICA').length,
      altos:     activos.filter(v => v.urgencia === 'ALTA').length,
      esteMes:   delMes.filter(v => !v.completado).length,
    };
  }, [enriched, delMes]);

  // ── Handlers de navegación del mes ──────────────────────────────────────────
  const cambiarMes = (delta) => {
    setMesActual(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0)  { m = 11; y--; }
      if (m > 11) { m = 0;  y++; }
      return { year: y, month: m };
    });
  };

  const nombreMes = new Date(mesActual.year, mesActual.month).toLocaleDateString('es-PE', {
    month: 'long', year: 'numeric',
  });

  // ── Handlers DnD ────────────────────────────────────────────────────────────
  const handleDragStart = (e, key) => {
    dragKeyRef.current = key;
    // dataTransfer es obligatorio en Firefox; algunos navegadores también lo requieren.
    try { e.dataTransfer.setData('text/plain', key); } catch { /* ignore */ }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    dragKeyRef.current = null;
    setDropTarget(null);
  };

  const handleDragOverCell = (e, fechaStr) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== fechaStr) setDropTarget(fechaStr);
  };

  const handleDragLeaveCell = (fechaStr) => {
    if (dropTarget === fechaStr) setDropTarget(null);
  };

  const handleDropCell = (e, fechaStr) => {
    e.preventDefault();
    setDropTarget(null);
    const key = dragKeyRef.current || e.dataTransfer.getData('text/plain');
    dragKeyRef.current = null;
    if (!key) return;

    // TODO-BACKEND: cuando exista el endpoint de actualización, reemplazar
    // este bloque por un await real, p.ej.:
    //   await nodeClient.patch(`/api/plazos/vencimientos/${encodeURIComponent(key)}`, { fecha_limite: fechaStr });
    // y solo entonces actualizar el estado local en el `.then()`.
    setOverridesFecha(prev => ({ ...prev, [key]: fechaStr }));
    const item = vencimientos.find(v => `${v.expediente_id}::${v.evento}` === key);
    toast.info(
      `Vencimiento movido a ${formatFecha(fechaStr)}${item ? ` — ${item.numero || ''}` : ''}. Endpoint de actualización pendiente — el cambio es local.`,
      { duration: 5000 }
    );
  };

  // ── Marcar completado (drop semántico) ──────────────────────────────────────
  const handleMarcarCompletado = (key) => {
    setOverridesCompletado(prev => ({ ...prev, [key]: true }));
    toast.success('Vencimiento marcado como completado (cambio local).', { duration: 3000 });
  };

  const handleReabrir = (key) => {
    setOverridesCompletado(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toast.info('Vencimiento reabierto.', { duration: 2500 });
  };

  // ── Exportar a Calendario (.ics) ─────────────────────────────────────────────
  // Recolecta los vencimientos visibles (listado del mes, respetando filtros y
  // "mostrar completados"), los envía a POST /api/herramientas/exportar-ics y
  // descarga la respuesta text/calendar como archivo .ics (Blob + objectURL).
  const handleExportarIcs = async () => {
    if (delMes.length === 0 || exportando) return;
    setExportError(null);

    // El backend acepta máximo 50 eventos por request (icsSchema max(50)).
    const MAX_EVENTOS = 50;
    const visibles = delMes.filter(v => v.fechaEfectiva);
    const eventos = visibles.slice(0, MAX_EVENTOS).map(v => ({
      titulo: `${v.numero} — ${v.evento_descripcion}`.slice(0, 200),
      fecha: v.fechaEfectiva,
      descripcion: `Expediente: ${v.numero} — ${v.titulo}${v.base_legal ? ` · ${v.base_legal}` : ''}`.slice(0, 500),
    }));

    if (visibles.length > MAX_EVENTOS) {
      toast.info(`Se exportarán solo los primeros ${MAX_EVENTOS} vencimientos (límite del endpoint).`, { duration: 5000 });
    }

    setExportando(true);
    try {
      const res = await nodeClient.post('/api/herramientas/exportar-ics', { eventos }, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vencimientos-legalpro.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${eventos.length} vencimiento${eventos.length === 1 ? '' : 's'} exportado${eventos.length === 1 ? '' : 's'} a .ics.`, { duration: 3500 });
    } catch (e) {
      // En error 4xx/5xx axios deja response.data como Blob: no hay JSON legible directo.
      const status = e?.response?.status;
      setExportError(
        e?.response?.data?.error ||
        `No se pudo generar el archivo .ics${status ? ` (HTTP ${status})` : ''}.`
      );
    } finally {
      setExportando(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-cyan-400" />
            Calendario de Vencimientos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Plazos procesales del backend (<code className="text-cyan-300/80">GET /api/plazos/vencimientos</code>).
            Arrastra un vencimiento a otra fecha para re-agendar (cambio local).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => cambiarMes(-1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 min-w-[180px] text-center capitalize">
            {nombreMes}
          </div>
          <button
            onClick={() => cambiarMes(1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              setMesActual({ year: d.getFullYear(), month: d.getMonth() });
            }}
            className="px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm"
            aria-label="Ir al mes actual"
          >
            Hoy
          </button>
          {/* Enlace a la vista mensual interactiva */}
          <Link
            to="/calendario-mensual"
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 whitespace-nowrap"
            aria-label="Abrir vista mensual del calendario"
          >
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
            Vista mensual
          </Link>
          {/* Exportar vencimientos visibles del mes a calendario (.ics) */}
          {delMes.length === 0 ? (
            <span
              title="No hay vencimientos visibles en este mes para exportar."
              className="inline-flex"
            >
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-sm cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <span aria-hidden="true">📅</span>
                <Download className="w-4 h-4" aria-hidden="true" />
                Exportar a Calendario (.ics)
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleExportarIcs}
              disabled={exportando}
              title={`Exportar ${delMes.length} vencimiento${delMes.length === 1 ? '' : 's'} de ${nombreMes} a un archivo .ics`}
              className="px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span aria-hidden="true">📅</span>
              <Download className="w-4 h-4" aria-hidden="true" />
              {exportando ? 'Exportando…' : 'Exportar a Calendario (.ics)'}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Vencidos"  value={stats.vencidos} color="red" />
        <KpiCard icon={<Clock className="w-4 h-4" />}        label="Críticos"  value={stats.criticos} color="amber" />
        <KpiCard icon={<Bell className="w-4 h-4" />}         label="Altos"     value={stats.altos}    color="yellow" />
        <KpiCard icon={<Calendar className="w-4 h-4" />}     label="Este mes"  value={stats.esteMes}  color="cyan" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          Filtros:
        </div>
        <label className="sr-only" htmlFor="filtro-materia">Filtrar por materia</label>
        <select
          id="filtro-materia"
          value={filtroMateria}
          onChange={e => setFiltroMateria(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
        >
          {MATERIAS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-300 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarCompletados}
            onChange={e => setMostrarCompletados(e.target.checked)}
            className="accent-cyan-500"
          />
          Mostrar completados ({completadosDelMes.length})
        </label>
      </div>

      {/* Estados de carga / error */}
      {loading && (
        <div className="text-center py-12 text-slate-400" role="status" aria-live="polite">
          Cargando vencimientos del servidor…
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400" role="alert">
          Error: {error}
        </div>
      )}

      {/* Error de exportación .ics */}
      {exportError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          {exportError}
        </div>
      )}

      {/* Grid mensual (drag & drop) */}
      {!loading && !error && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-3">
          <div className="grid grid-cols-7 gap-1 mb-1" role="row">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
              <div key={d} className="text-center text-xs text-slate-400 font-medium py-2" role="columnheader">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid">
            {gridDays.map((dia, i) => {
              if (dia === null) {
                return <div key={`empty-${i}`} className="min-h-[88px] sm:min-h-[100px] rounded border border-transparent" />;
              }
              const fechaStr = ymd(mesActual.year, mesActual.month, dia);
              const habil = esDiaHabil(fechaStr);
              const nombreFeriado = getNombreFeriado(fechaStr);
              const esFeriado = !!nombreFeriado;
              const items = byDay[fechaStr] || [];
              const isDropTarget = dropTarget === fechaStr;
              const cellStyle = isDropTarget
                ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/60'
                : habil
                  ? 'bg-white/5 border-white/10'
                  : esFeriado
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-slate-700/30 border-slate-600/30';

              return (
                <div
                  key={fechaStr}
                  role="button"
                  tabIndex={0}
                  aria-label={`${fechaStr}${esFeriado ? `, feriado ${nombreFeriado}` : habil ? ', día hábil' : ', día inhábil'}, ${items.length} vencimiento${items.length === 1 ? '' : 's'}`}
                  onDragOver={(e) => handleDragOverCell(e, fechaStr)}
                  onDragLeave={() => handleDragLeaveCell(fechaStr)}
                  onDrop={(e) => handleDropCell(e, fechaStr)}
                  onKeyDown={(e) => {
                    // Accesibilidad: Enter/Espacio sobre celda con foco no hace nada
                    // (la celda es drop-target, no botón de acción). Evita foco
                    // "muerto" sin comportamiento.
                    if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                  }}
                  className={`min-h-[88px] sm:min-h-[100px] rounded border p-1.5 text-left transition-colors ${cellStyle} focus:outline-none focus:ring-2 focus:ring-cyan-500/60`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className={`text-sm font-medium ${habil ? 'text-white' : 'text-slate-500'}`}>{dia}</div>
                    {items.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {items.length}
                      </span>
                    )}
                  </div>
                  {esFeriado && (
                    <div className="text-[10px] text-red-400 leading-tight" title={nombreFeriado}>
                      {nombreFeriado}
                    </div>
                  )}
                  {!habil && !esFeriado && (
                    <div className="text-[10px] text-slate-500">Fin de semana</div>
                  )}
                  <ul className="space-y-1 mt-1">
                    {items.slice(0, 3).map(v => (
                      <VencimientoChip
                        key={v.key}
                        v={v}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onMarcarCompletado={handleMarcarCompletado}
                      />
                    ))}
                    {items.length > 3 && (
                      <li className="text-[10px] text-slate-400">+{items.length - 3} más</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400 mt-3">
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white/5 border border-white/10 rounded" /><span>Día hábil</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500/10 border border-red-500/30 rounded" /><span>Feriado</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-700/30 border border-slate-600/30 rounded" /><span>Fin de semana</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-cyan-500/20 border border-cyan-400/60 rounded" /><span>Drop target activo</span></div>
          </div>
        </div>
      )}

      {/* Listado detallado del mes (drag source + Marcar completado) */}
      {!loading && !error && (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Vencimientos de {nombreMes}
            </h2>
            <span className="text-xs text-slate-400">
              {pendientesDelMes.length} pendientes · {completadosDelMes.length} completados
            </span>
          </div>

          {delMes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay vencimientos en {nombreMes}.</p>
              <p className="text-xs mt-2">Cambia de mes o ajusta el filtro de materia.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5" role="list">
              <AnimatePresence initial={false}>
                {delMes.map((v, i) => {
                  const style = URGENCIA_STYLE[v.urgencia] || URGENCIA_STYLE.BAJA;
                  if (v.completado) {
                    return (
                      <motion.li
                        key={v.key}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 0.6, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ delay: i * 0.015 }}
                        className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium line-through truncate">
                            {v.numero} — {v.titulo}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {v.evento_descripcion} · Vencia: {formatFecha(v.fechaEfectiva)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleReabrir(v.key)}
                          className="text-xs px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
                          aria-label={`Reabrir vencimiento de ${v.numero}`}
                        >
                          Reabrir
                        </button>
                      </motion.li>
                    );
                  }
                  return (
                    <motion.li
                      key={v.key}
                      layout
                      draggable
                      onDragStart={(e) => handleDragStart(e, v.key)}
                      onDragEnd={handleDragEnd}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.015 }}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] cursor-grab active:cursor-grabbing ${style.bg}`}
                      aria-label={`Arrastrable: ${v.numero}, ${v.evento_descripcion}, vence ${formatFecha(v.fechaEfectiva)}`}
                    >
                      <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" aria-hidden="true" />
                      <div className="text-xl flex-shrink-0" aria-hidden="true">{style.icon}</div>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/expediente/${v.expediente_id}`}
                          className="text-white font-medium hover:text-cyan-400 truncate block"
                          onClick={(e) => e.stopPropagation()}
                          onDragStart={(e) => e.preventDefault()} /* el link no inicia drag */
                        >
                          {v.numero} — {v.titulo}
                        </Link>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="capitalize">{v.materia}</span>
                          <span aria-hidden="true">·</span>
                          <span>{v.evento_descripcion}</span>
                          <span aria-hidden="true">·</span>
                          <span>Vence: {formatFecha(v.fechaEfectiva)}</span>
                          {v.base_legal && (
                            <>
                              <span aria-hidden="true">·</span>
                              <code className="text-[10px] px-1 py-0.5 bg-white/5 rounded text-slate-300">{v.base_legal}</code>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`text-xs font-semibold ${style.text} px-2.5 py-1 rounded-full whitespace-nowrap`}>
                        {style.label}{v.diff !== null && v.diff >= 0 ? ` (${v.diff}d)` : v.diff !== null ? ` (hace ${Math.abs(v.diff)}d)` : ''}
                      </div>
                      <button
                        onClick={() => handleMarcarCompletado(v.key)}
                        className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        aria-label={`Marcar como completado: ${v.numero}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completado
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}

      {/* Disclaimer legal */}
      <div className="text-xs text-slate-500 border-t border-white/5 pt-4">
        <strong className="text-slate-400">Disclaimer:</strong> Vencimientos calculados por el backend
        (<code className="mx-1 px-1 py-0.5 bg-white/5 rounded">GET /api/plazos/vencimientos</code>)
        según <code className="mx-1 px-1 py-0.5 bg-white/5 rounded">catalogs/plazos-procesales.json</code> y
        feriados de <code className="mx-1 px-1 py-0.5 bg-white/5 rounded">catalogs/feriados-peru.json</code> (CPC Art. 144).
        Los cambios por drag &amp; drop y “Marcar completado” son <strong>locales</strong> hasta que el backend
        exponga endpoints de escritura. Verifica contra el texto oficial (SPIJ). No constituye asesoría legal.
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

/** Chip compacto mostrado dentro de las celdas del grid mensual. */
function VencimientoChip({ v, onDragStart, onDragEnd, onMarcarCompletado }) {
  const style = URGENCIA_STYLE[v.urgencia] || URGENCIA_STYLE.BAJA;
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, v.key)}
      onDragEnd={onDragEnd}
      className={`group text-[10px] leading-tight rounded px-1.5 py-1 border cursor-grab active:cursor-grabbing ${style.bg} ${style.text} border-white/10 hover:border-cyan-400/60`}
      title={`${v.numero} — ${v.evento_descripcion} (${formatFecha(v.fechaEfectiva)})`}
      aria-label={`Vencimiento ${v.numero}, ${v.evento_descripcion}, ${formatFecha(v.fechaEfectiva)}`}
    >
      <div className="flex items-center gap-1">
        <span aria-hidden="true">{style.icon}</span>
        <span className="truncate font-medium">{v.numero || v.expediente_id}</span>
        {v.completado && <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" aria-label="completado" />}
      </div>
      <div className="truncate text-slate-300/80">{v.evento_descripcion}</div>
      {!v.completado && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarcarCompletado(v.key); }}
          className="mt-1 text-[9px] uppercase tracking-wide text-emerald-300 hover:text-emerald-200 focus:outline-none focus:underline"
          aria-label={`Marcar como completado: ${v.numero}`}
        >
          Completar
        </button>
      )}
    </li>
  );
}

function KpiCard({ icon, label, value, color }) {
  const colors = {
    red:    'border-red-500/30 bg-red-500/10 text-red-400',
    amber:  'border-amber-500/30 bg-amber-500/10 text-amber-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    cyan:   'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  };
  return (
    <div className={`rounded-xl border ${colors[color]} px-4 py-3`}>
      <div className="flex items-center gap-2 text-xs">
        {icon}
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
