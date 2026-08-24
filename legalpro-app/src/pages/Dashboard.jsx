import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import ActivityAreaChart from '../components/charts/ActivityAreaChart';
import MateriaPieChart from '../components/charts/MateriaPieChart';
import {
  FolderOpen, AlertTriangle, FileText, TrendingUp, TrendingDown, Sparkles, Bell,
  BarChart3, ChevronRight, ChevronDown, ChevronUp, Clock, Coins,
  GripVertical, RotateCcw, Search, MessageSquareText, CalendarClock, PenLine,
  Wrench, Hourglass, Briefcase, Percent, Calculator, Ungroup, LayoutGrid,
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';
import { nodeClient } from '../api/client';
import { exportToExcel } from '../utils/documents';
import SpriteIcon from '../components/ui/SpriteIcon';
import { fixUtf8Mojibake } from '../utils/utf8';
import { useSeo } from '../hooks/useSeo';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useWidgetLayout, WIDGET_DEFS } from '../hooks/useWidgetLayout';

/* ════════════════════════════════════════════════════════════════════════
   Dashboard V2 — widgets drag&drop (HTML5 nativo), mobile-first y
   navegación mejorada (quick actions, Ctrl+K, headers sticky por sección).
   ════════════════════════════════════════════════════════════════════════ */

const QUICK_ACTIONS = [
  { to: '/chat-ia',             icon: MessageSquareText, label: 'Chat IA' },
  { to: '/calendario-plazos',   icon: CalendarClock,     label: 'Plazos' },
  { to: '/redactor',            icon: PenLine,           label: 'Redactor' },
  { to: '/buscador',            icon: Search,            label: 'Buscador' },
  { to: '/herramientas',        icon: Wrench,            label: 'Herramientas' },
  { to: '/control-horas',       icon: Clock,             label: 'Control de horas' },
];

const CALC_LINKS = [
  { to: '/conversor-plazos',      icon: Hourglass,  label: 'Conversor de plazos' },
  { to: '/indemnizacion-despido', icon: Briefcase,  label: 'Indemnización despido' },
  { to: '/tasas-comparativo',     icon: Percent,    label: 'Tasas comparativo' },
  { to: '/conversor-uit',         icon: Calculator, label: 'Conversor UIT' },
];

const ESTADO_STYLES = {
  urgente:   { bg: 'bg-red-500/15',   text: 'text-red-400',   border: 'border-red-500/30',   label: 'Urgente' },
  pendiente: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Pendiente' },
  activo:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Activo' },
  archivado: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Archivado' },
};

const MATERIA_STYLES = {
  civil: 'text-blue-400', penal: 'text-red-400', laboral: 'text-amber-400',
  constitucional: 'text-violet-400', familia: 'text-pink-400', administrativo: 'text-emerald-400',
};

function formatMateria(tipo) {
  if (!tipo) return 'General';
  const t = String(tipo).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function daysSince(iso) {
  if (!iso) return '—';
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function diasHasta(fecha) {
  if (!fecha) return Number.POSITIVE_INFINITY;
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
}

function formatFechaCorta(fecha) {
  if (!fecha) return '—';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

function displayName(usuario) {
  const raw = fixUtf8Mojibake(usuario?.nombreCompleto || usuario?.nombre || 'Abogado');
  return /^dr\.?\s/i.test(raw) ? raw : raw.split(' ')[0];
}

const HORA = new Date().getHours();
const SALUDO = HORA < 12 ? 'Buenos días' : HORA < 18 ? 'Buenas tardes' : 'Buenas noches';

/* ── Variantes Framer Motion (sutiles; framer respeta reduced-motion en whileHover) ── */
const container = { animate: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } } };
const item = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/* ═══════════════ KPI Card (intacto — mismo estilo V1) ═══════════════ */
function KpiCard({ icon: Icon, label, value, displayValue, loading, trend, trendUp, accentColor, glowColor, to, tooltip }) {
  return (
    <motion.div variants={item} whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
      <Link to={to || '#'} className="block h-full">
        <div className="relative overflow-hidden h-full backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-2xl p-5 hover:bg-slate-800/40 hover:border-white/12 transition-all duration-300 shadow-xl shadow-black/25 flex flex-col justify-between">
          <div className={`absolute -top-10 -right-10 w-24 h-24 ${glowColor} rounded-full blur-2xl opacity-40 pointer-events-none`} />
          <div className="flex items-start justify-between mb-4">
            <div className={`p-2.5 rounded-xl border border-white/5 ${accentColor}`}>
              <Icon size={18} className="text-current" />
            </div>
            {trend && !loading && (
              <span className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full
                ${trendUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {trend}
              </span>
            )}
          </div>
          <div>
            <p
              className="text-2xl lg:text-3xl font-extrabold text-white mb-1 tracking-tight flex items-center"
              title={tooltip}
            >
              {loading ? (
                <span className="inline-block w-6 h-6 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
              ) : displayValue != null ? (
                // FIX anti-mock A: valores no numéricos (p.ej. "—" cuando no hay
                // datos suficientes) no deben pasar por CountUp.
                <span>{displayValue}</span>
              ) : (
                <CountUp end={value} duration={1.2} />
              )}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-2xl p-5 shadow-lg animate-pulse flex flex-col justify-between h-32">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 bg-white/5 rounded-xl" />
        <div className="w-12 h-4 bg-white/5 rounded-full" />
      </div>
      <div>
        <div className="w-16 h-8 bg-white/5 rounded-md mb-2" />
        <div className="w-24 h-3 bg-white/5 rounded-sm" />
      </div>
    </div>
  );
}

/* ═══════════════ WidgetShell — arrastrable + controles de orden ═══════════════ */
function WidgetShell({
  itemId, title, span = '', canDrag, draggingId, dropHint,
  onDragStart, onDragOver, onDrop, onDragEnd, onMoveOffset,
  headerExtra, children,
}) {
  const isDragging = draggingId === itemId;
  const hint = dropHint?.itemId === itemId ? dropHint.mode : null;

  return (
    <div
      role="listitem"
      aria-grabbed={canDrag ? isDragging : undefined}
      data-widget-id={itemId}
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, itemId)}
      onDragOver={(e) => onDragOver(e, itemId)}
      onDrop={(e) => onDrop(e, itemId)}
      onDragEnd={onDragEnd}
      className={[
        'group/widget relative rounded-2xl bg-slate-900/60 border backdrop-blur-xl transition-all duration-200',
        isDragging ? 'opacity-40 border-cyan-500/40 border-dashed' : 'border-slate-800',
        hint === 'on' ? 'ring-2 ring-cyan-400/70 ring-offset-0 border-cyan-400/50' : '',
        span,
      ].join(' ')}
    >
      {/* Indicadores de inserción (reordenar) */}
      {hint === 'before' && (
        <span aria-hidden="true" className="absolute -top-2 left-3 right-3 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10" />
      )}
      {hint === 'after' && (
        <span aria-hidden="true" className="absolute -bottom-2 left-3 right-3 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10" />
      )}

      {/* Cabecera del widget: handle drag + título + controles */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <span
          aria-hidden="true"
          title="Arrastra para mover o agrupar"
          className={[
            'hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg',
            'text-slate-600',
            canDrag ? 'opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing' : 'invisible',
          ].join(' ')}
        >
          <GripVertical size={16} />
        </span>

        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex-1 truncate">{title}</h3>

        {headerExtra}

        {/* Reordenar accesible (móvil + teclado): targets ≥44px */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            aria-label={`Subir widget ${title}`}
            onClick={() => onMoveOffset(itemId, -1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
          >
            <ChevronUp size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Bajar widget ${title}`}
            onClick={() => onMoveOffset(itemId, 1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

/* ═══════════════ GroupCard — grupo colapsable con pestañas internas ═══════════════ */
function GroupCard({
  group, canDrag, draggingId, dropHint,
  onDragStart, onDragOver, onDrop, onDragEnd, onMoveOffset,
  onToggleCollapsed, onSetTab, onUngroup, renderWidgetContent,
}) {
  const isDragging = draggingId === group.id;
  const hint = dropHint?.itemId === group.id ? dropHint.mode : null;
  const collapsed = !!group.collapsed;
  const activeTab = Math.min(group.activeTab ?? 0, group.widgets.length - 1);
  const groupTitle = group.widgets.map((w) => WIDGET_DEFS[w]?.title ?? w).slice(0, 2).join(' + ') + (group.widgets.length > 2 ? ` +${group.widgets.length - 2}` : '');

  return (
    <div
      role="listitem"
      aria-grabbed={canDrag ? isDragging : undefined}
      data-widget-id={group.id}
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, group.id)}
      onDragOver={(e) => onDragOver(e, group.id)}
      onDrop={(e) => onDrop(e, group.id)}
      onDragEnd={onDragEnd}
      className={[
        'group/widget relative rounded-2xl bg-slate-900/70 border backdrop-blur-xl transition-all duration-200',
        isDragging ? 'opacity-40 border-cyan-500/40 border-dashed' : 'border-slate-700',
        hint === 'on' ? 'ring-2 ring-cyan-400/70 border-cyan-400/50' : '',
      ].join(' ')}
    >
      {hint === 'before' && <span aria-hidden="true" className="absolute -top-2 left-3 right-3 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10" />}
      {hint === 'after' && <span aria-hidden="true" className="absolute -bottom-2 left-3 right-3 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10" />}

      {/* Cabecera del grupo */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <span aria-hidden="true" className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-slate-600 opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical size={16} />
        </span>
        <button
          type="button"
          onClick={() => onToggleCollapsed(group.id)}
          aria-expanded={!collapsed}
          aria-controls={`grp-panel-${group.id}`}
          aria-label={`${collapsed ? 'Expandir' : 'Colapsar'} grupo: ${groupTitle}`}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
        >
          <ChevronDown size={18} aria-hidden="true" className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        <LayoutGrid size={14} aria-hidden="true" className="text-cyan-400/80 shrink-0" />
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex-1 truncate px-1">{groupTitle}</h3>
        <span className="shrink-0 mr-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
          {group.widgets.length}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            aria-label={`Subir grupo ${groupTitle}`}
            onClick={() => onMoveOffset(group.id, -1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
          >
            <ChevronUp size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Bajar grupo ${groupTitle}`}
            onClick={() => onMoveOffset(group.id, 1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Pestañas internas */}
          <div role="tablist" aria-label={`Widgets del grupo ${groupTitle}`} className="flex gap-1 px-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-slate-800">
            {group.widgets.map((wid, i) => (
              <button
                key={wid}
                role="tab"
                id={`tab-${group.id}-${i}`}
                aria-selected={i === activeTab}
                aria-controls={`panel-${group.id}-${i}`}
                tabIndex={i === activeTab ? 0 : -1}
                onClick={() => onSetTab(group.id, i)}
                className={[
                  'min-h-[44px] px-3 whitespace-nowrap text-xs font-bold rounded-t-lg border-b-2 transition-colors',
                  i === activeTab
                    ? 'text-cyan-300 border-cyan-400 bg-slate-800/50'
                    : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30',
                ].join(' ')}
              >
                {WIDGET_DEFS[wid]?.title ?? wid}
              </button>
            ))}
          </div>

          {/* Panel activo */}
          {group.widgets.map((wid, i) => (
            <div
              key={wid}
              role="tabpanel"
              id={`panel-${group.id}-${i}`}
              aria-labelledby={`tab-${group.id}-${i}`}
              hidden={i !== activeTab}
              className="p-4"
            >
              {i === activeTab && (
                <>
                  <div className="flex justify-end mb-1">
                    <button
                      type="button"
                      onClick={() => onUngroup(group.id, wid)}
                      aria-label={`Sacar ${WIDGET_DEFS[wid]?.title ?? wid} del grupo`}
                      className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-amber-300 hover:bg-slate-800/60 transition-colors"
                    >
                      <Ungroup size={13} aria-hidden="true" /> Sacar del grupo
                    </button>
                  </div>
                  {renderWidgetContent(wid)}
                </>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ═══════════════ Widgets nuevos compactos ═══════════════ */

function VencimientosWidget({ items, loading }) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="h-11 bg-slate-800/50 rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (!items.length) {
    return <p className="py-6 text-center text-xs text-slate-400 font-medium">Sin vencimientos en los próximos 90 días.</p>;
  }
  return (
    <ul className="divide-y divide-slate-800/60 -mx-1">
      {items.map((v, i) => {
        const diff = diasHasta(v.fecha_limite);
        const badge = diff <= 3
          ? 'bg-red-500/15 text-red-400 border-red-500/30'
          : diff <= 7
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-slate-500/15 text-slate-400 border-slate-500/30';
        return (
          <li key={`${v.expediente_id}-${v.evento}-${i}`} className="flex items-center gap-3 py-2.5 px-1">
            <span className={`shrink-0 w-9 h-9 rounded-lg border flex flex-col items-center justify-center text-[10px] font-extrabold ${badge}`}>
              {Number.isFinite(diff) ? diff : '—'}
              <span className="sr-only">días</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">{v.evento || 'Vencimiento'}</p>
              <p className="text-[11px] text-slate-400 truncate">
                Exp. {v.expediente_id ?? '—'} · <span className={MATERIA_STYLES[String(v.materia || v.tipo || '').toLowerCase()] ?? 'text-slate-400'}>{formatMateria(v.materia || v.tipo)}</span>
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Clock size={11} aria-hidden="true" /> {formatFechaCorta(v.fecha_limite)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CreditosWidget({ creditos, plan, loading }) {
  const pct = Math.max(4, Math.min(100, creditos));
  return (
    <div>
      <div className="flex items-end gap-3 mb-3">
        <p className="text-3xl font-extrabold text-amber-300 tracking-tight flex items-center" aria-live="polite">
          {loading
            ? <span className="inline-block w-6 h-6 rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" aria-label="Cargando créditos" />
            : <CountUp end={creditos} duration={1} />}
          <Coins size={20} aria-hidden="true" className="ml-2 text-amber-400/80" />
        </p>
        <span className="mb-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
          Plan {plan || 'Pro'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-1" role="presentation">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-slate-400 mb-3">Gemas disponibles para consultas IA.</p>
      <Link
        to="/creditos"
        className="inline-flex min-h-[44px] items-center px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
      >
        Recargar créditos <ChevronRight size={13} aria-hidden="true" className="ml-1" />
      </Link>
    </div>
  );
}

function CalcWidget() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CALC_LINKS.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/70 hover:border-cyan-500/40 hover:bg-slate-800 transition-all text-xs font-semibold text-slate-200 hover:text-cyan-300"
        >
          <Icon size={15} aria-hidden="true" className="text-cyan-400 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════ Normalización de stats (igual que V1) ═══════════════ */
function normalizeDashboardStats(data) {
  if (!data || typeof data !== 'object') return data;
  const materia = data.materia?.length
    ? data.materia
    : [
        { name: 'Civil', value: data.civiles ?? 0 },
        { name: 'Penal', value: data.penales ?? 0 },
        { name: 'Laboral', value: data.laborales ?? 0 },
        { name: 'Constitucional', value: data.constitucionales ?? 0 },
        { name: 'Familia', value: data.familia ?? 0 },
        { name: 'Administrativo', value: data.administrativos ?? 0 },
      ].filter((m) => m.value > 0);

  let activity = data.activity;
  if (!activity?.length) {
    const now = new Date();
    activity = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        mes: d.toLocaleDateString('es-PE', { month: 'short' }),
        nuevos: i === 5 ? (data.total ?? 0) : 0,
        resueltos: 0,
        proceso: i === 5 ? (data.activos ?? 0) : 0,
      };
    });
  }

  return {
    ...data,
    escritosMes: data.escritosMes ?? 0,
    // FIX anti-mock A (2026-08-24): la tasa de éxito la calcula el backend con
    // resultados REALES (favorables/desfavorables de casos cerrados/resueltos).
    // Si es null (datos insuficientes) se muestra "—" + motivo; NUNCA inventar
    // un número en cliente como fórmula fallback.
    tasaExito: data.tasaExito ?? null,
    tasaExitoMotivo: data.tasaExitoMotivo ?? 'datos insuficientes',
    materia,
    activity,
  };
}

/* ═══════════════════════════ PÁGINA ═══════════════════════════ */
export default function Dashboard() {
  const { usuario, organizacion } = useTenant();
  const { toast, openCommand } = useUI();

  /* ── Layout persistente (drag & drop + grupos) ── */
  const userId = usuario?.id ?? null;
  const {
    sections, isCustomized, moveWidget, dropOnItem, ungroupWidget,
    moveByOffset, toggleGroupCollapsed, setGroupTab, resetLayout,
  } = useWidgetLayout(userId);

  /* Drag & drop solo con puntero fino y ≥768px (en táctil se usan ↑↓) */
  const canDrag = useMediaQuery('(min-width: 768px) and (pointer: fine)');

  const dragRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropHint, setDropHint] = useState(null); // { itemId | null, mode: 'before'|'after'|'on'|'end', sectionId }
  const [announce, setAnnounce] = useState('');

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
    setDropHint(null);
  }, []);

  const handleDragStart = useCallback((e, id) => {
    if (!canDrag) { e.preventDefault(); return; }
    dragRef.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', `widget:${id}`); } catch { /* IE */ }
  }, [canDrag]);

  const handleDragOver = useCallback((e, itemId) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / Math.max(rect.height, 1);
    const mode = ratio < 0.33 ? 'before' : ratio > 0.67 ? 'after' : 'on';
    setDropHint((prev) => (prev?.itemId === itemId && prev?.mode === mode ? prev : { itemId, mode }));
  }, []);

  const handleDrop = useCallback((e, itemId, sectionId) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = dragRef.current;
    const mode = dropHint?.mode;
    clearDrag();
    if (!dragId || dragId === itemId) return;

    if (mode === 'on') {
      dropOnItem(dragId, itemId);
      setAnnounce('Widget agrupado. El grupo es colapsable y tiene pestañas.');
    } else {
      moveWidget(dragId, sectionId, itemId, mode === 'before' ? 'before' : 'after');
      setAnnounce('Widget movido.');
    }
  }, [dropHint, clearDrag, dropOnItem, moveWidget]);

  const handleSectionDropEnd = useCallback((sectionId) => {
    // Soltar sobre zona vacía de la sección → append al final
    const dragId = dragRef.current;
    clearDrag();
    if (!dragId) return;
    moveWidget(dragId, sectionId);
    setAnnounce('Widget movido al final de la sección.');
  }, [clearDrag, moveWidget]);

  const handleMoveOffset = useCallback((itemId, delta) => {
    moveByOffset(itemId, delta);
    setAnnounce(delta < 0 ? 'Widget subido.' : 'Widget bajado.');
  }, [moveByOffset]);

  const handleReset = useCallback(() => {
    resetLayout();
    setAnnounce('Layout restaurado al diseño predeterminado.');
    toast.success('Layout del dashboard restaurado');
  }, [resetLayout, toast]);

  /* ── Datos (mismos endpoints que V1 + vencimientos) ── */
  const [stats, setStats] = useState({ total: 0, urgentes: 0, escritosMes: 0, tasaExito: null, tasaExitoMotivo: 'datos insuficientes' });
  const [loadingStats, setLoadingStats] = useState(true);
  const [creditos, setCreditos] = useState(0);
  const [activityData, setActivityData] = useState([]);
  const [materiaData, setMateriaData] = useState([]);
  const [expedientesRecientes, setExpedientesRecientes] = useState([]);
  const [loadingExpedientes, setLoadingExpedientes] = useState(true);
  const [notificaciones, setNotificaciones] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [vencimientos, setVencimientos] = useState([]);
  const [loadingVencimientos, setLoadingVencimientos] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  useSeo({
    title: 'Dashboard | LegalPro',
    description: 'Panel de control ejecutivo de tu estudio jurídico en LegalPro.',
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const isAbortError = (err) => err?.name === 'AbortError' || err?.code === 'ERR_CANCELED';

    nodeClient.get('/api/expedientes/stats', { signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        const data = normalizeDashboardStats(r.data?.data ?? r.data);
        setStats(data);
        if (data.activity) setActivityData(data.activity);
        if (data.materia) setMateriaData(data.materia);
      })
      .catch((err) => { if (!isAbortError(err)) { /* stats quedan en 0 */ } })
      .finally(() => { if (!cancelled) setLoadingStats(false); });

    nodeClient.get('/api/organizaciones/me', { signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        const org = r.data?.data ?? r.data;
        if (org?.creditosDisponibles != null) setCreditos(org.creditosDisponibles);
      })
      .catch(() => {});

    nodeClient.get('/api/expedientes', { params: { limit: 5 }, signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        setExpedientesRecientes(r.data?.data?.expedientes ?? r.data?.expedientes ?? []);
      })
      .catch((err) => { if (!isAbortError(err)) setExpedientesRecientes([]); })
      .finally(() => { if (!cancelled) setLoadingExpedientes(false); });

    nodeClient.get('/api/notificaciones', { signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        setNotificaciones(r.data?.data ?? r.data ?? []);
      })
      .catch((err) => { if (!isAbortError(err)) setNotificaciones([]); })
      .finally(() => { if (!cancelled) setLoadingNotifs(false); });

    nodeClient.get('/api/plazos/vencimientos', { params: { dias: 90 }, signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        const items = r.data?.data?.vencimientos ?? r.data?.vencimientos ?? [];
        const sorted = [...(Array.isArray(items) ? items : [])]
          .sort((a, b) => String(a.fecha_limite ?? '').localeCompare(String(b.fecha_limite ?? '')))
          .slice(0, 5);
        setVencimientos(sorted);
      })
      .catch((err) => { if (!isAbortError(err)) setVencimientos([]); })
      .finally(() => { if (!cancelled) setLoadingVencimientos(false); });

    return () => { cancelled = true; controller.abort(); };
  }, []);

  /* ── Contenido de cada widget (usado suelto y dentro de grupos) ── */
  const renderWidgetContent = useCallback((widgetId) => {
    switch (widgetId) {
      case 'kpis':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingStats ? (
              <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
            ) : (
              <>
                <KpiCard icon={FolderOpen} label="Expedientes Activos" value={stats.total || 0} trend="+8% mes" trendUp to="/expedientes" accentColor="bg-blue-500/10 text-blue-400" glowColor="bg-blue-500/10" />
                <KpiCard icon={AlertTriangle} label="Urgencias Procesales" value={stats.urgentes || 0} trend="Plazos críticos" trendUp={false} to="/calendario-vencimientos" accentColor="bg-red-500/10 text-red-400" glowColor="bg-red-500/10" />
                <KpiCard icon={FileText} label="Escritos Generados" value={stats.escritosMes || 0} trend="Asistidos por IA" trendUp to="/redactor" accentColor="bg-violet-500/10 text-violet-400" glowColor="bg-violet-500/10" />
                {/* FIX anti-mock A (2026-08-24): tasa de éxito REAL del backend.
                    null → "—" + tooltip 'Datos insuficientes (mín. 5 casos resueltos)',
                    nunca un número inventado. */}
                <KpiCard
                  icon={Percent}
                  label="Tasa de Éxito"
                  displayValue={stats.tasaExito != null ? `${stats.tasaExito}%` : '—'}
                  value={0}
                  tooltip={stats.tasaExito != null ? undefined : 'Datos insuficientes (mín. 5 casos resueltos)'}
                  trend={stats.tasaExito != null ? 'Casos con resultado' : (stats.tasaExitoMotivo || 'datos insuficientes')}
                  trendUp={stats.tasaExito != null}
                  to="/expedientes"
                  accentColor="bg-emerald-500/10 text-emerald-400"
                  glowColor="bg-emerald-500/10"
                />
                <KpiCard icon={Coins} label="Créditos IA Disponibles" value={creditos} trend="Gemas" trendUp to="/creditos" accentColor="bg-amber-500/10 text-amber-400" glowColor="bg-amber-500/10" />
              </>
            )}
          </div>
        );

      case 'actividad':
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">Evolución de expedientes · últimos 6 meses</p>
              <button
                onClick={async () => {
                  if (!activityData.length) return;
                  setExportLoading(true);
                  try {
                    const today = new Date().toISOString().split('T')[0];
                    await exportToExcel(activityData, `Carga_Procesal_${today}.xlsx`, ['mes', 'nuevos', 'resueltos', 'proceso']);
                  } catch {
                    toast.error('Error al exportar reporte de carga procesal');
                  } finally {
                    setExportLoading(false);
                  }
                }}
                disabled={exportLoading || !activityData.length}
                className="min-h-[44px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <BarChart3 size={13} /> Exportar
              </button>
            </div>
            <div className="h-[200px]">
              <ActivityAreaChart data={activityData} />
            </div>
          </>
        );

      case 'expedientes':
        return (
          <div className="-mx-4 -mb-4 divide-y divide-slate-800/60">
            {loadingExpedientes ? (
              <div className="p-5 space-y-3">
                <div className="h-10 bg-slate-800/50 rounded-xl animate-pulse" />
                <div className="h-10 bg-slate-800/50 rounded-xl animate-pulse" />
              </div>
            ) : expedientesRecientes.length > 0 ? (
              expedientesRecientes.map((exp) => {
                const estadoKey = exp.es_urgente ? 'urgente' : (exp.estado || 'activo');
                const es = ESTADO_STYLES[estadoKey] ?? ESTADO_STYLES.activo;
                const materiaKey = String(exp.tipo || '').toLowerCase();
                return (
                  <Link key={exp.id} to="/expedientes" className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors shrink-0">
                        <FolderOpen size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate">{exp.titulo}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {exp.numero} · <span className={MATERIA_STYLES[materiaKey]}>{formatMateria(exp.tipo)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${es.bg} ${es.text} ${es.border}`}>{es.label}</span>
                      <span className="text-[11px] text-slate-500 hidden sm:block">{daysSince(exp.created_at)}d</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">No hay expedientes recientes registrados.</div>
            )}
            <div className="px-4 py-2.5">
              <Link to="/expedientes" className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 min-h-[44px]">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        );

      case 'vencimientos':
        return (
          <>
            <VencimientosWidget items={vencimientos} loading={loadingVencimientos} />
            <Link to="/calendario-vencimientos" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 min-h-[44px]">
              Ver calendario completo <ChevronRight size={12} />
            </Link>
          </>
        );

      case 'materia':
        return (
          <>
            <div className="h-[140px] my-2">
              <MateriaPieChart data={materiaData} />
            </div>
            <div className="space-y-1.5 mt-3">
              {materiaData.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">{m.name}</span>
                  <span className="font-bold text-slate-200">{m.value}%</span>
                </div>
              ))}
            </div>
          </>
        );

      case 'sinoe':
        return (
          <div className="-mx-4 -mb-4 divide-y divide-slate-800/60">
            {loadingNotifs ? (
              <div className="p-4 space-y-2"><div className="h-6 bg-slate-800/50 rounded-lg animate-pulse" /></div>
            ) : notificaciones.length > 0 ? (
              notificaciones.slice(0, 4).map((notif) => (
                <div key={notif.id} className="p-3.5 hover:bg-slate-800/30 transition-colors">
                  <p className={`text-xs font-bold ${notif.tipo === 'urgente' ? 'text-red-400' : 'text-slate-300'}`}>{notif.titulo}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{notif.desc}</p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs font-medium">Sin notificaciones SINOE pendientes.</div>
            )}
            <div className="px-4 py-2.5">
              <Link to="/monitor-sinoe" className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 min-h-[44px]">
                Ver todas <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        );

      case 'creditos':
        return <CreditosWidget creditos={creditos} plan={organizacion?.plan} loading={loadingStats} />;

      case 'calc':
        return <CalcWidget />;

      default:
        return null;
    }
  }, [stats, loadingStats, creditos, activityData, expedientesRecientes, loadingExpedientes,
      vencimientos, loadingVencimientos, materiaData, notificaciones, loadingNotifs,
      organizacion?.plan, toast, exportLoading]);

  const nombreCorto = useMemo(() => displayName(usuario), [usuario]);

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="p-4 sm:p-6 max-w-[1400px] mx-auto pb-28 sm:pb-24 space-y-5"
    >

      {/* ── HEADER EJECUTIVO + Ctrl+K + Restaurar layout ────── */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 icon-shadow-cyan">
            <SpriteIcon name="dashboard" size={26} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight truncate">
                {SALUDO}, {nombreCorto}
              </h1>
              {organizacion && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                  {organizacion.plan || 'Pro'}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {organizacion ? ` · ${organizacion.nombre}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {/* Búsqueda global visible con atajo (abre CommandPalette existente) */}
          <button
            type="button"
            onClick={openCommand}
            aria-label="Abrir búsqueda global (Ctrl+K)"
            className="min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-2"
          >
            <Search size={14} aria-hidden="true" />
            <span className="hidden md:inline">Buscar</span>
            <kbd className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-white/8 border border-white/12 rounded text-slate-400">Ctrl+K</kbd>
          </button>
          <Link
            to="/chat-ia"
            className="min-h-[44px] px-3 sm:px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5"
          >
            <Sparkles size={14} /> <span className="hidden sm:inline">Consultar LexIA</span>
            <span className="sm:hidden">LexIA</span>
          </Link>
        </div>
      </motion.div>

      {/* ── QUICK ACTIONS: chips scrollables (navegación mejorada) ── */}
      <motion.nav variants={item} aria-label="Acciones rápidas" className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto snap-x pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="snap-start shrink-0 min-h-[44px] inline-flex items-center gap-2 px-4 rounded-full bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 text-xs font-bold text-slate-200 hover:text-cyan-300 transition-all"
            >
              <Icon size={15} aria-hidden="true" className="text-cyan-400" />
              {label}
            </Link>
          ))}
        </div>
      </motion.nav>

      {/* ── BARRA DE PERSONALIZACIÓN ─────────────────────────── */}
      <motion.div variants={item} className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 min-w-0">
          <GripVertical size={12} aria-hidden="true" className="shrink-0" />
          {canDrag
            ? 'Arrastra widgets para reordenar; suelta uno sobre otro para agruparlos.'
            : 'Usa las flechas ↑↓ de cada widget para reordenar.'}
          <span className="sr-only" aria-live="polite">{announce}</span>
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={!isCustomized}
          className="min-h-[44px] px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
        >
          <RotateCcw size={13} aria-hidden="true" /> Restaurar layout
        </button>
      </motion.div>

      {/* ── SECCIONES CON HEADERS STICKY + GRID DRAGGABLE ────── */}
      {sections.map((section) => {
        const nWidgets = section.items.reduce((acc, it) => acc + (it.t === 'g' ? it.widgets.length : 1), 0);
        const nGrupos = section.items.filter((it) => it.t === 'g').length;
        return (
          <motion.section key={section.id} variants={item} aria-label={`Sección ${section.title}`}>
            {/* Header sticky bajo el TopBar (h-16) */}
            <div className="sticky top-16 z-20 -mx-4 sm:mx-0 px-4 sm:px-3 py-2 mb-3 rounded-none sm:rounded-xl bg-slate-950/85 backdrop-blur-md border-y sm:border border-slate-800 flex items-center gap-2">
              <nav aria-label="Ruta de sección" className="flex items-center gap-1.5 text-[11px] min-w-0">
                <Link to="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors font-semibold">Inicio</Link>
                <ChevronRight size={11} aria-hidden="true" className="text-slate-600 shrink-0" />
                <span className="font-bold text-slate-200 truncate">{section.title}</span>
              </nav>
              <span className="ml-auto flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700">
                  {nWidgets} widget{nWidgets !== 1 ? 's' : ''}
                </span>
                {nGrupos > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                    {nGrupos} grupo{nGrupos !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
            </div>

            {/* Grid responsive real: 1 col móvil → 2 tablet → 3 desktop */}
            <div
              role="list"
              aria-label={`Widgets de ${section.title}`}
              className={[
                'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 items-start rounded-2xl transition-all duration-200',
                dropHint?.mode === 'end' && dropHint?.sectionId === section.id
                  ? 'ring-2 ring-cyan-400/40 ring-dashed bg-slate-900/30'
                  : '',
              ].join(' ')}
              onDragOver={(e) => {
                if (!dragRef.current) return;
                e.preventDefault();
                setDropHint((prev) => (prev?.mode === 'end' && prev?.sectionId === section.id ? prev : { itemId: null, mode: 'end', sectionId: section.id }));
              }}
              onDrop={(e) => { e.preventDefault(); handleSectionDropEnd(section.id); }}
            >
              {section.items.map((it) =>
                it.t === 'g' ? (
                  <GroupCard
                    key={it.id}
                    group={it}
                    canDrag={canDrag}
                    draggingId={draggingId}
                    dropHint={dropHint}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={clearDrag}
                    onMoveOffset={handleMoveOffset}
                    onToggleCollapsed={toggleGroupCollapsed}
                    onSetTab={setGroupTab}
                    onUngroup={(gid, wid) => { ungroupWidget(gid, wid); setAnnounce('Widget sacado del grupo.'); }}
                    renderWidgetContent={renderWidgetContent}
                  />
                ) : (
                  <WidgetShell
                    key={it.id}
                    itemId={it.id}
                    title={WIDGET_DEFS[it.id]?.title ?? it.id}
                    span={WIDGET_DEFS[it.id]?.span ?? ''}
                    canDrag={canDrag}
                    draggingId={draggingId}
                    dropHint={dropHint}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={clearDrag}
                    onMoveOffset={handleMoveOffset}
                  >
                    {renderWidgetContent(it.id)}
                  </WidgetShell>
                ),
              )}
            </div>
          </motion.section>
        );
      })}

      {/* ── FOOTER DE CUMPLIMIENTO LEGAL LPDP ────────────────── */}
      <motion.footer variants={item} className="pt-4 border-t border-slate-800/60 text-center">
        <p className="text-[11px] text-slate-500">
          🛡️ <strong>LegalPro Compliance</strong>: Operación adaptada a la Ley N° 29733 (Protección de Datos Personales de Perú) y estándares internacionales de confidencialidad e IA ética.
        </p>
      </motion.footer>
    </motion.div>
  );
}
