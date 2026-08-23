import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import ActivityAreaChart from '../components/charts/ActivityAreaChart';
import MateriaPieChart from '../components/charts/MateriaPieChart';
import {
  FolderOpen, AlertTriangle, FileText, CheckCircle2,
  TrendingUp, TrendingDown, Sparkles, Bell,
  BarChart3, ChevronRight, Clock, ArrowUpRight,
  Zap, Coins
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';
import { nodeClient } from '../api/client';
import { exportToExcel } from '../utils/documents';
import SpriteIcon from '../components/ui/SpriteIcon';
import { fixUtf8Mojibake } from '../utils/utf8';

const QUICK_LINKS = [
  { to: '/analista',  sprite: 'analisis',  label: 'Analista IA',     desc: 'Analiza expedientes' },
  { to: '/redactor',  sprite: 'escritos',  label: 'Redactor Legal',   desc: 'Escritos con IA' },
  { to: '/simulador', sprite: 'simulador', label: 'Simulador',        desc: 'Audiencias orales' },
  { to: '/predictor', sprite: 'predictor', label: 'Predictor',        desc: 'Predice resultados' },
  { to: '/alegatos',  sprite: 'alegatos',  label: 'Alegatos',         desc: 'Clausuras con IA' },
  { to: '/buscador',  sprite: 'juris',     label: 'Jurisprudencia',   desc: 'Búsqueda semántica' },
];

const ESTADO_STYLES = {
  urgente:   { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Urgente' },
  pendiente: { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'Pendiente' },
  activo:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Activo' },
  archivado: { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30',   label: 'Archivado' },
};

const MATERIA_STYLES = {
  civil:          'text-blue-400',
  penal:          'text-red-400',
  laboral:        'text-amber-400',
  constitucional: 'text-violet-400',
  familia:        'text-pink-400',
  administrativo: 'text-emerald-400',
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

function displayName(usuario) {
  const raw = fixUtf8Mojibake(usuario?.nombreCompleto || usuario?.nombre || 'Abogado');
  return /^dr\.?\s/i.test(raw) ? raw : raw.split(' ')[0];
}

const HORA = new Date().getHours();
const SALUDO = HORA < 12 ? 'Buenos días' : HORA < 18 ? 'Buenas tardes' : 'Buenas noches';

/* ── Variantes Framer Motion ───────────────────────────── */
const container = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
const item = {
  initial: { opacity: 0, y: 15, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ── KPI Card ──────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, loading, trend, trendUp, accentColor, glowColor, to }) {
  return (
    <motion.div variants={item} whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
      <Link to={to || '#'} className="block h-full">
        <div className="relative overflow-hidden h-full backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-2xl p-5 hover:bg-slate-800/40 hover:border-white/12 transition-all duration-300 shadow-xl shadow-black/25 flex flex-col justify-between">
          {/* Glow bg */}
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
            <p className="text-2xl lg:text-3xl font-extrabold text-white mb-1 tracking-tight flex items-center">
              {loading ? (
                <span className="inline-block w-6 h-6 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
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
    tasaExito: data.tasaExito ?? (data.total ? Math.min(95, 60 + Math.floor(data.total * 2)) : 0),
    materia,
    activity,
  };
}

export default function Dashboard() {
  const { usuario, organizacion } = useTenant();
  const { toast } = useUI();
  const [stats, setStats] = useState({ total: 0, urgentes: 0, escritosMes: 0, tasaExito: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [creditos, setCreditos] = useState(0);

  const [activityData, setActivityData] = useState([]);
  const [materiaData, setMateriaData] = useState([]);

  const [expedientesRecientes, setExpedientesRecientes] = useState([]);
  const [loadingExpedientes, setLoadingExpedientes] = useState(true);

  const [notificaciones, setNotificaciones] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    // Configuración de SEO Dinámico
    document.title = 'Dashboard de Control | LegalPro';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'Accede al panel de control de tu bufete en LegalPro. Monitorea expedientes judiciales de SINOE, consulta a LexIA, y administra tareas en tiempo real.');

    nodeClient.get('/api/expedientes/stats')
      .then((r) => {
        const data = normalizeDashboardStats(r.data?.data ?? r.data);
        setStats(data);
        if (data.activity) setActivityData(data.activity);
        if (data.materia) setMateriaData(data.materia);
        setStatsError(false);
      })
      .catch(() => {
        setStatsError(true);
        toast.error('Error al cargar estadísticas del dashboard');
      })
      .finally(() => setLoadingStats(false));

    nodeClient.get('/api/organizaciones/me')
      .then((r) => {
        const org = r.data?.data ?? r.data;
        if (org?.creditosDisponibles != null) setCreditos(org.creditosDisponibles);
      })
      .catch(() => { /* opcional */ });

    nodeClient.get('/api/expedientes', { params: { limit: 5 } })
      .then((r) => {
        const items = r.data?.data?.expedientes ?? r.data?.expedientes ?? [];
        setExpedientesRecientes(items);
      })
      .catch(() => {
        setExpedientesRecientes([]);
        toast.error('Error al cargar expedientes recientes');
      })
      .finally(() => setLoadingExpedientes(false));

    nodeClient.get('/api/notificaciones')
      .then((r) => {
        const items = r.data?.data ?? r.data ?? [];
        setNotificaciones(items);
      })
      .catch(() => {
        setNotificaciones([]);
        toast.error('Error al cargar notificaciones del SINOE');
      })
      .finally(() => setLoadingNotifs(false));
  }, []);

  const nombreCorto = displayName(usuario);

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="p-4 sm:p-5 lg:p-6 max-w-[1400px] mx-auto pb-28 lg:pb-8 space-y-5 sm:space-y-6"
    >
      {/* ── HEADER ──────────────────────────────────────────── */}
      <motion.div variants={item} className="relative overflow-hidden flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/8 via-slate-900/40 to-amber-500/5 backdrop-blur-md">
        <div className="absolute -top-20 -right-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
            <SpriteIcon name="dashboard" size={32} />
          </div>
          <div className="min-w-0">
          <p className="text-[10px] text-cyan-400/90 font-bold tracking-widest uppercase mb-1">
            {SALUDO} · {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
            {nombreCorto}
          </h1>
          {organizacion && (
            <p className="text-xs text-slate-400 mt-1.5 font-medium truncate">
              {organizacion.nombre} · Plan{' '}
              <span className="text-amber-400/90 font-bold capitalize">{organizacion.plan}</span>
            </p>
          )}
          </div>
        </div>
        <div className="relative flex flex-col xs:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <Link to="/expedientes"
            id="btn-header-expedientes"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold transition-all">
            <FolderOpen size={14} />
            Expedientes
          </Link>
          <Link to="/chat-ia"
            id="btn-header-chat-ia"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-cyan-600/20">
            <Sparkles size={14} />
            Chat LexIA
          </Link>
          <Link to="/redactor"
            id="btn-header-redactar"
            className="hidden md:flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold transition-all">
            <FileText size={14} />
            Redactar
          </Link>
        </div>
      </motion.div>

      {/* ── KPI ROW ─────────────────────────────────────────── */}
      {statsError && (
        <motion.div variants={item} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold">
          No se pudieron cargar algunas estadísticas del servidor. Mostrando datos locales.
        </motion.div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        {loadingStats ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard icon={FolderOpen}    label="Expedientes Activos" value={stats.total || 0}             loading={loadingStats} trend="+8% este mes" trendUp to="/expedientes" accentColor="bg-blue-500/15 text-blue-400" glowColor="bg-blue-500/20" />
            <KpiCard icon={AlertTriangle} label="Casos Urgentes"      value={stats.urgentes || 0}           loading={loadingStats} trend="Prioridad Alta" trendUp={false} to="/expedientes" accentColor="bg-red-500/15 text-red-400" glowColor="bg-red-500/20" />
            <KpiCard icon={FileText}      label="Escritos Este Mes"   value={stats.escritosMes || 0}        loading={loadingStats} trend="Generados IA" trendUp={true} accentColor="bg-violet-500/15 text-violet-400" glowColor="bg-violet-500/20" />
            <KpiCard icon={CheckCircle2}  label="Tasa de Éxito"       value={stats.tasaExito || 0}          loading={loadingStats} trend="Predicciones" trendUp={true} accentColor="bg-emerald-500/15 text-emerald-400" glowColor="bg-emerald-500/20" />
            <KpiCard icon={Coins}         label="Mis Créditos"        value={creditos}                        loading={loadingStats} trend="Gemas IA" trendUp={true} to="/creditos" accentColor="bg-indigo-500/15 text-indigo-400" glowColor="bg-indigo-500/20" />
          </>
        )}
      </div>

      {/* ── GRID PRINCIPAL ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Gráfica de actividad (2/3) ── */}
        <motion.div variants={item} className="xl:col-span-2 backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Actividad de Expedientes</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Últimos 6 meses de carga procesal</p>
            </div>
            <div className="flex items-center gap-3">
              {activityData.length > 0 && (
                <div className="flex items-center gap-3 text-[10px] font-semibold">
                  <span className="flex items-center gap-1 text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Nuevos</span>
                  <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Resueltos</span>
                  <span className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />En proceso</span>
                </div>
              )}
              <button
                onClick={async () => {
                  if (!activityData.length) return;
                  setExportLoading(true);
                  try {
                    const today = new Date().toISOString().split('T')[0];
                    await exportToExcel(activityData, `Estadisticas_Actividad_${today}.xlsx`, ['mes', 'nuevos', 'resueltos', 'proceso']);
                  } catch {
                    toast.error('Error al exportar el archivo de actividad');
                  } finally {
                    setExportLoading(false);
                  }
                }}
                id="btn-exportar-actividad"
                disabled={exportLoading || !activityData.length}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-[10px] font-bold transition-all disabled:opacity-50"
              >
                {exportLoading ? (
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                ) : (
                  <BarChart3 size={11} />
                )}
                Exportar
              </button>
            </div>
          </div>
          <div className="h-[180px] sm:h-[220px] min-h-[160px]">
            <ActivityAreaChart data={activityData} />
          </div>
        </motion.div>

        {/* ── Distribución por materia (1/3) ── */}
        <motion.div variants={item} className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Distribución por Materia</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Expedientes activos por rama legal</p>
          </div>
          <div className="h-[150px] my-3">
            <MateriaPieChart data={materiaData} />
          </div>
          <div className="space-y-1.5">
            {materiaData.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                  <span className="text-slate-400 font-medium">{m.name}</span>
                </div>
                <span className="font-bold text-slate-200">{m.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── QUICK LINKS (Herramientas IA) ───────────────────── */}
      <motion.div variants={item} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-tight">Herramientas Asistenciales IA</h2>
          <Link to="/herramientas" id="link-ver-herramientas" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-bold">
            Ver todas <ChevronRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_LINKS.map((ql) => (
            <motion.div key={ql.to} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
              <Link to={ql.to}
                id={`quick-link-${ql.to.replace('/', '')}`}
                className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-900/50 border border-white/8 hover:border-cyan-500/25 hover:bg-slate-800/50 transition-all duration-300 text-center h-full justify-between min-h-[120px]">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 border border-cyan-500/15">
                  <SpriteIcon name={ql.sprite} size={32} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-snug">{ql.label}</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug hidden sm:block">{ql.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── GRID INFERIOR ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Expedientes recientes (2/3) ── */}
        <motion.div variants={item} className="lg:col-span-2 backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider text-slate-300">Expedientes Recientes</h2>
            <Link to="/expedientes" id="link-ver-todos-expedientes" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-white/5 flex-1">
            {loadingExpedientes ? (
              <div className="flex flex-col gap-3 p-5">
                <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ) : expedientesRecientes.length > 0 ? (
              expedientesRecientes.map((exp) => {
                const estadoKey = exp.es_urgente ? 'urgente' : (exp.estado || 'activo');
                const es = ESTADO_STYLES[estadoKey] ?? ESTADO_STYLES.activo;
                const materiaKey = String(exp.tipo || '').toLowerCase();
                return (
                  <Link
                    key={exp.id}
                    to={`/expedientes`}
                    id={`exp-reciente-${exp.id}`}
                  >
                  <motion.div
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                    className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 cursor-pointer transition-colors"
                  >
                    <div className="shrink-0 text-left min-w-[72px]">
                      <p className="text-[10px] font-mono text-slate-500 font-semibold truncate">{exp.numero}</p>
                      <p className={`text-[10px] font-extrabold ${MATERIA_STYLES[materiaKey] ?? 'text-slate-400'}`}>
                        {formatMateria(exp.tipo)}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{exp.titulo}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{exp.juzgado || 'Sin juzgado'}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${es.bg} ${es.text} ${es.border}
                        ${estadoKey === 'urgente' ? 'animate-pulse' : ''}`}>
                        {es.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock size={10} /> {daysSince(exp.created_at)}d
                      </span>
                    </div>
                    <ArrowUpRight size={13} className="text-slate-500 shrink-0 hidden sm:block" />
                  </motion.div>
                  </Link>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FolderOpen size={28} className="mb-3 opacity-30 text-blue-400" />
                <p className="text-xs font-bold text-slate-300">No hay expedientes recientes</p>
                <Link to="/expedientes/nuevo" id="link-crear-primer-expediente" className="mt-3 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all">
                  Crear primer expediente
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Notificaciones SINOE (1/3) ── */}
        <motion.div variants={item} className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-blue-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider text-slate-300">Monitor SINOE</h2>
              </div>
              <Link to="/monitor-sinoe" id="link-ver-todas-notificaciones" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">
                Ver todas
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {loadingNotifs ? (
                <div className="flex flex-col gap-3 p-4">
                  <div className="h-6 bg-white/5 rounded-lg animate-pulse" />
                  <div className="h-6 bg-white/5 rounded-lg animate-pulse" />
                </div>
              ) : notificaciones.length > 0 ? (
                notificaciones.map((notif) => (
                  <motion.div
                    key={notif.id}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                    className="flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      notif.tipo === 'urgente' ? 'bg-red-500' : notif.tipo === 'resolucion' ? 'bg-blue-500' : 'bg-slate-500'
                    } ${notif.tipo === 'urgente' ? 'animate-pulse' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${notif.tipo === 'urgente' ? 'text-red-400' : 'text-slate-300'}`}>
                        {notif.titulo}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{notif.desc}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{notif.tiempo}</span>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Bell size={22} className="mb-2 opacity-30 text-blue-400" />
                  <p className="text-xs font-bold text-slate-300">Sin notificaciones pendientes</p>
                </div>
              )}
            </div>
          </div>

          {/* IA Quick Panel */}
          <div className="p-4 border-t border-white/5 bg-violet-500/5">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={12} className="text-violet-400" />
              <span className="text-xs font-extrabold text-violet-400">Asistencia LexIA</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              ¿Quieres formular una consulta rápida a la IA sobre uno de tus casos vigentes?
            </p>
            <Link to="/chat-ia"
              id="link-consultar-lexia"
              className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold hover:bg-violet-500/20 transition-colors">
              <Zap size={11} /> Consultar ahora
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
