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
import { useSeo } from '../hooks/useSeo';

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

  useSeo({
    title: 'Dashboard | LegalPro',
    description: 'Panel de control ejecutivo de tu estudio jurídico en LegalPro.',
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const isAbortError = (err) => err?.name === 'AbortError' || err?.code === 'ERR_CANCELED';

    nodeClient
      .get('/api/expedientes/stats', { signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        const data = normalizeDashboardStats(r.data?.data ?? r.data);
        setStats(data);
        if (data.activity) setActivityData(data.activity);
        if (data.materia) setMateriaData(data.materia);
        setStatsError(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setStatsError(true);
      })
      .finally(() => { if (!cancelled) setLoadingStats(false); });

    nodeClient
      .get('/api/organizaciones/me', { signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        const org = r.data?.data ?? r.data;
        if (org?.creditosDisponibles != null) setCreditos(org.creditosDisponibles);
      })
      .catch(() => {});

    nodeClient
      .get('/api/expedientes', { params: { limit: 5 }, signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        const items = r.data?.data?.expedientes ?? r.data?.expedientes ?? [];
        setExpedientesRecientes(items);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setExpedientesRecientes([]);
      })
      .finally(() => { if (!cancelled) setLoadingExpedientes(false); });

    nodeClient
      .get('/api/notificaciones', { signal: controller.signal })
      .then((r) => {
        if (cancelled) return;
        const items = r.data?.data ?? r.data ?? [];
        setNotificaciones(items);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setNotificaciones([]);
      })
      .finally(() => { if (!cancelled) setLoadingNotifs(false); });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const nombreCorto = displayName(usuario);

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="p-4 sm:p-6 max-w-[1400px] mx-auto pb-24 space-y-6"
    >
      {/* ── HEADER EJECUTIVO SOBRIO ──────────────────────────── */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 icon-shadow-cyan">
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

        <div className="flex items-center gap-2 sm:gap-2.5 self-end sm:self-auto">
          <Link
            to="/expedientes/nuevo"
            id="btn-header-nuevo-expediente"
            className="px-3 sm:px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <FolderOpen size={14} /> <span className="hidden xs:inline sm:inline">Nuevo Expediente</span>
            <span className="xs:hidden sm:hidden">Nuevo</span>
          </Link>
          <Link
            to="/chat-ia"
            id="btn-header-consultar-lexia"
            className="px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5"
          >
            <Sparkles size={14} /> <span className="hidden xs:inline sm:inline">Consultar LexIA</span>
            <span className="xs:hidden sm:hidden">LexIA</span>
          </Link>
        </div>
      </motion.div>

      {/* ── METRICAS CLAVE (KPIs LIMPIOS) ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              icon={FolderOpen}
              label="Expedientes Activos"
              value={stats.total || 0}
              loading={loadingStats}
              trend="+8% mes"
              trendUp={true}
              to="/expedientes"
              accentColor="bg-blue-500/10 text-blue-400"
              glowColor="bg-blue-500/10"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Urgencias Procesales"
              value={stats.urgentes || 0}
              loading={loadingStats}
              trend="Plazos críticos"
              trendUp={false}
              to="/expedientes"
              accentColor="bg-red-500/10 text-red-400"
              glowColor="bg-red-500/10"
            />
            <KpiCard
              icon={FileText}
              label="Escritos Generados"
              value={stats.escritosMes || 0}
              loading={loadingStats}
              trend="Asistidos por IA"
              trendUp={true}
              to="/redactor"
              accentColor="bg-violet-500/10 text-violet-400"
              glowColor="bg-violet-500/10"
            />
            <KpiCard
              icon={Coins}
              label="Créditos IA Disponibles"
              value={creditos}
              loading={loadingStats}
              trend="Gemas"
              trendUp={true}
              to="/creditos"
              accentColor="bg-amber-500/10 text-amber-400"
              glowColor="bg-amber-500/10"
            />
          </>
        )}
      </div>

      {/* ── ACCESOS DIRECTOS COMPACTOS ──────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {QUICK_LINKS.map((ql) => (
          <Link
            key={ql.to}
            to={ql.to}
            id={`quick-link-${ql.to.replace('/', '')}`}
            className="flex flex-col items-center p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/50 transition-all text-center group icon-shadow-cyan"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:scale-105 transition-transform mb-2">
              <SpriteIcon name={ql.sprite} size={24} />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">{ql.label}</span>
            <span className="text-[10px] text-slate-400 truncate max-w-full mt-0.5">{ql.desc}</span>
          </Link>
        ))}
      </motion.div>

      {/* ── GRID PRINCIPAL DE ACTIVIDAD Y EXPEDIENTES ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Columna Principal (2/3): Actividad + Expedientes ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Gráfico de Carga Procesal */}
          <motion.div variants={item} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Carga Procesal Reciente</h2>
                <p className="text-xs text-slate-400">Evolución de expedientes en los últimos 6 meses</p>
              </div>
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
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <BarChart3 size={13} /> Exportar
              </button>
            </div>
            <div className="h-[200px]">
              <ActivityAreaChart data={activityData} />
            </div>
          </motion.div>

          {/* Tabla de Expedientes Recientes */}
          <motion.div variants={item} className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Expedientes Recientes</h2>
              <Link to="/expedientes" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60">
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
                    <Link
                      key={exp.id}
                      to="/expedientes"
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors shrink-0">
                          <FolderOpen size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                            {exp.titulo}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {exp.numero} · <span className={MATERIA_STYLES[materiaKey]}>{formatMateria(exp.tipo)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${es.bg} ${es.text} ${es.border}`}>
                          {es.label}
                        </span>
                        <span className="text-[11px] text-slate-500 hidden sm:block">
                          {daysSince(exp.created_at)}d
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No hay expedientes recientes registrados.
                </div>
              )}
            </div>
          </motion.div>

        </div>

        {/* ── Columna Lateral (1/3): Distribución por Materia & SINOE ── */}
        <div className="space-y-6">

          {/* Distribución por Materia */}
          <motion.div variants={item} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
            <h2 className="text-sm font-bold text-white mb-1">Distribución por Materia</h2>
            <p className="text-xs text-slate-400 mb-3">Casos clasificados por área</p>
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
          </motion.div>

          {/* Notificaciones SINOE */}
          <motion.div variants={item} className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-slate-200">
                <Bell size={14} className="text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider">Monitor SINOE</h2>
              </div>
              <Link to="/monitor-sinoe" className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                Ver todas
              </Link>
            </div>
            <div className="divide-y divide-slate-800/60">
              {loadingNotifs ? (
                <div className="p-4 space-y-2">
                  <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse" />
                </div>
              ) : notificaciones.length > 0 ? (
                notificaciones.slice(0, 4).map((notif) => (
                  <div key={notif.id} className="p-3.5 hover:bg-slate-800/30 transition-colors">
                    <p className={`text-xs font-bold ${notif.tipo === 'urgente' ? 'text-red-400' : 'text-slate-300'}`}>
                      {notif.titulo}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{notif.desc}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs font-medium">
                  Sin notificaciones SINOE pendientes.
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── FOOTER DE CUMPLIMIENTO LEGAL LPDP ────────────────── */}
      <motion.div variants={item} className="pt-4 border-t border-slate-800/60 text-center">
        <p className="text-[11px] text-slate-500">
          🛡️ <strong>LegalPro Compliance</strong>: Operación adaptada a la Ley N° 29733 (Protección de Datos Personales de Perú) y estándares internacionales de confidencialidad e IA ética.
        </p>
      </motion.div>
    </motion.div>
  );
}

