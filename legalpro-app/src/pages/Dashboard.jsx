import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  FolderOpen, AlertTriangle, FileText, CheckCircle2,
  TrendingUp, TrendingDown, Sparkles, Bell, Scale, BookOpen,
  FileEdit, Mic2, BarChart3, ChevronRight, Clock, ArrowUpRight,
  Zap, Shield, Eye
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import api from '../api/client';
import { exportToExcel } from '../utils/documents';

const QUICK_LINKS = [
  { to: '/analista',  icon: BarChart3, label: 'Analista IA',     desc: 'Analiza expedientes',    color: 'from-blue-500/20 to-indigo-500/10',   iconClass: 'text-blue-400',    bg: 'bg-blue-500/15' },
  { to: '/redactor',  icon: FileEdit,  label: 'Redactor Legal',   desc: 'Escritos con IA',        color: 'from-cyan-500/20 to-sky-500/10',      iconClass: 'text-cyan-400',    bg: 'bg-cyan-500/15' },
  { to: '/simulador', icon: Scale,     label: 'Simulador',        desc: 'Audiencias orales',      color: 'from-amber-500/20 to-orange-500/10',  iconClass: 'text-amber-400',   bg: 'bg-amber-500/15' },
  { to: '/predictor', icon: TrendingUp,label: 'Predictor',        desc: 'Predice resultados',     color: 'from-emerald-500/20 to-green-500/10', iconClass: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  { to: '/alegatos',  icon: Mic2,      label: 'Alegatos',         desc: 'Clausuras con IA',       color: 'from-pink-500/20 to-rose-500/10',     iconClass: 'text-pink-400',    bg: 'bg-pink-500/15' },
  { to: '/buscador',  icon: BookOpen,  label: 'Jurisprudencia',   desc: 'BÃºsqueda semÃ¡ntica',     color: 'from-violet-500/20 to-purple-500/10', iconClass: 'text-violet-400',  bg: 'bg-violet-500/15' },
];

const ESTADO_STYLES = {
  urgente:   { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Urgente' },
  pendiente: { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'Pendiente' },
  activo:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Activo' },
  archivado: { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30',   label: 'Archivado' },
};

const MATERIA_STYLES = {
  Civil:          'text-blue-400',
  Penal:          'text-red-400',
  Laboral:        'text-amber-400',
  Constitucional: 'text-violet-400',
  Familia:        'text-pink-400',
};

const HORA = new Date().getHours();
const SALUDO = HORA < 12 ? 'Buenos dÃ­as' : HORA < 18 ? 'Buenas tardes' : 'Buenas noches';

/* â”€â”€ Variantes Framer Motion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const container = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
};

/* â”€â”€ Tooltip personalizado recharts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800/95 backdrop-blur border border-white/12 rounded-xl p-3 shadow-xl">
      <p className="text-xs font-bold text-white mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* â”€â”€ KPI Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function KpiCard({ icon: Icon, label, value, loading, trend, trendUp, accentColor, glowColor, to }) {
  return (
    <motion.div variants={item} whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
      <Link to={to || '#'} className="block">
        <div className={`relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/7 hover:border-white/20 transition-all duration-300 shadow-lg`}>
          {/* Glow bg */}
          <div className={`absolute -top-6 -right-6 w-20 h-20 ${glowColor} rounded-full blur-2xl opacity-60 pointer-events-none`} />
          <div className="flex items-start justify-between mb-4">
            <div className={`p-2.5 ${accentColor} rounded-xl border border-white/10`}>
              <Icon size={18} className="text-current" />
            </div>
            {trend && !loading && (
              <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full
                ${trendUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend}
              </span>
            )}
          </div>
          <p className="text-2xl lg:text-3xl font-extrabold text-white mb-1 h-10 flex items-center">
            {loading ? (
              <span className="inline-block w-6 h-6 rounded-full border-2 border-white/10 border-t-white animate-spin" />
            ) : (
              <CountUp end={value} duration={1.5} />
            )}
          </p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
      {Icon && <Icon size={32} className="mb-3 opacity-40" />}
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">{subtitle}</p>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  DASHBOARD PRINCIPAL                                       */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function Dashboard() {
  const { usuario, organizacion } = useTenant();
  const [stats, setStats] = useState({ civiles: 0, penales: 0, total: 0, urgentes: 0, laborales: 0, constitucionales: 0, familia: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const [activityData, setActivityData] = useState([]);
  const [materiaData, setMateriaData] = useState([]);

  const [expedientesRecientes, setExpedientesRecientes] = useState([]);
  const [loadingExpedientes, setLoadingExpedientes] = useState(true);

  const [notificaciones, setNotificaciones] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    api.getStats()
      .then((data) => {
        setStats(data);
        if (data.activity) setActivityData(data.activity);
        if (data.materia) setMateriaData(data.materia);
        setStatsError(false);
      })
      .catch(() => setStatsError(true))
      .finally(() => setLoadingStats(false));

    const expPromise = api.getExpedientes ? api.getExpedientes({ limit: 5 }) : Promise.resolve([]);
    expPromise
      .then(setExpedientesRecientes)
      .catch(() => setExpedientesRecientes([]))
      .finally(() => setLoadingExpedientes(false));

    const notifPromise = api.getNotificaciones ? api.getNotificaciones() : Promise.resolve([]);
    notifPromise
      .then(setNotificaciones)
      .catch(() => setNotificaciones([]))
      .finally(() => setLoadingNotifs(false));
  }, []);

  const nombreCorto = (usuario?.nombreCompleto || usuario?.nombre || 'Abogado').split(' ')[0];

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="p-4 lg:p-6 max-w-350 mx-auto pb-24 lg:pb-8"
    >
      {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.div variants={item} className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mb-1">
              {SALUDO}, {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight">
              Dr. {nombreCorto} <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-violet-400">ðŸ‘‹</span>
            </h1>
            {organizacion && (
              <p className="text-sm text-slate-400 mt-1">{organizacion.nombre} · Plan {organizacion.plan}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/expedientes"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 border border-white/12 hover:bg-white/12 hover:border-white/20 text-slate-300 text-sm font-semibold transition-all">
              <FolderOpen size={15} />
              Expedientes
            </Link>
            <Link to="/redactor"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/25">
              <Sparkles size={15} />
              Redactar con IA
            </Link>
          </div>
        </div>
      </motion.div>

      {/* â”€â”€ KPI ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {statsError && (
        <motion.div variants={item} className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          No se pudieron cargar las estadísticas. Intenta recargar.
        </motion.div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={FolderOpen}    label="Expedientes Activos" value={stats.total || 0}             loading={loadingStats} trend="+12%" trendUp to="/expedientes" accentColor="bg-blue-500/15 text-blue-400"    glowColor="bg-blue-500/20" />
        <KpiCard icon={AlertTriangle} label="Vencen Esta Semana"  value={stats.urgentes || 0}           loading={loadingStats} trend="â†‘ Urgente" trendUp={false} to="/expedientes" accentColor="bg-red-500/15 text-red-400" glowColor="bg-red-500/20" />
        <KpiCard icon={FileText}      label="Escritos Este Mes"   value={0}                             loading={loadingStats} accentColor="bg-violet-500/15 text-violet-400" glowColor="bg-violet-500/20" />
        <KpiCard icon={CheckCircle2}  label="Tasa de Ã‰xito"       value={0} loading={loadingStats} accentColor="bg-emerald-500/15 text-emerald-400" glowColor="bg-emerald-500/20" />
      </div>

      {/* â”€â”€ GRID PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

        {/* â”€ GrÃ¡fica de actividad (2/3) â”€ */}
        <motion.div variants={item} className="xl:col-span-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white">Actividad de Expedientes</h2>
              <p className="text-xs text-slate-400 mt-0.5">Útimos 6 meses</p>
            </div>
            <div className="flex items-center gap-3">
              {activityData.length > 0 && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Nuevos</span>
                  <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Resueltos</span>
                  <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />En proceso</span>
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
                    // Error silencioso para no romper UI
                  } finally {
                    setExportLoading(false);
                  }
                }}
                disabled={exportLoading || !activityData.length}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 hover:bg-white/12 text-slate-300 text-[10px] font-semibold transition-all disabled:opacity-50"
                title="Exportar estadísticas"
              >
                {exportLoading ? (
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                ) : (
                  <BarChart3 size={12} />
                )}
                Exportar
              </button>
            </div>
          </div>
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={activityData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBlue"    x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGreen"   x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAmber"   x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="nuevos"    name="Nuevos"    stroke="#3B82F6" strokeWidth={2} fill="url(#gBlue)" />
                <Area type="monotone" dataKey="resueltos" name="Resueltos" stroke="#10B981" strokeWidth={2} fill="url(#gGreen)" />
                <Area type="monotone" dataKey="proceso"   name="En proceso" stroke="#F59E0B" strokeWidth={2} fill="url(#gAmber)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="Aún no hay actividad registrada"
              subtitle="Los gráficos aparecerán cuando tengas expedientes en el sistema."
            />
          )}
        </motion.div>

        {/* â”€ DistribuciÃ³n por materia (1/3) â”€ */}
        <motion.div variants={item} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
          <h2 className="text-base font-bold text-white mb-1">Por Materia</h2>
          <p className="text-xs text-slate-400 mb-5">Distribución actual</p>
          {materiaData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={materiaData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                    {materiaData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {materiaData.map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                      <span className="text-xs text-slate-400">{m.name}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{m.value}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Scale}
              title="Sin datos de materia"
              subtitle="Aquí se mostrará la distribución por materia cuando registres expedientes."
            />
          )}
        </motion.div>
      </div>

      {/* â”€â”€ QUICK LINKS (Herramientas IA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.div variants={item} className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Herramientas IA</h2>
          <Link to="/herramientas" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors font-semibold">
            Ver todas <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_LINKS.map((ql) => (
            <motion.div key={ql.to} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }}>
              <Link to={ql.to}
                className={`group flex flex-col items-center gap-3 p-4 rounded-2xl bg-linear-to-br ${ql.color} border border-white/10 hover:border-white/20 transition-all duration-300 text-center`}>
                <div className={`w-11 h-11 ${ql.bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                  <ql.icon size={20} className={ql.iconClass} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{ql.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">{ql.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* â”€â”€ GRID INFERIOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* â”€ Expedientes recientes (2/3) â”€ */}
        <motion.div variants={item} className="lg:col-span-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <h2 className="text-sm font-bold text-white">Expedientes Recientes</h2>
            <Link to="/expedientes" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {loadingExpedientes ? (
              <div className="flex items-center justify-center h-32">
                <span className="inline-block w-6 h-6 rounded-full border-2 border-white/10 border-t-white animate-spin" />
              </div>
            ) : expedientesRecientes.length > 0 ? (
              expedientesRecientes.map((exp, i) => {
                const es = ESTADO_STYLES[exp.estado] ?? ESTADO_STYLES.activo;
                return (
                  <motion.div
                    key={i}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors"
                  >
                    {/* NÃºmero */}
                    <div className="shrink-0">
                      <p className="text-xs font-mono text-slate-400">NÂ° {exp.num}</p>
                      <p className={`text-[11px] font-bold ${MATERIA_STYLES[exp.materia] ?? 'text-slate-400'}`}>{exp.materia}</p>
                    </div>
                    {/* TÃ­tulo */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{exp.titulo}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{exp.actores}</p>
                    </div>
                    {/* Estado + tiempo */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${es.bg} ${es.text} ${es.border}
                        ${exp.estado === 'urgente' ? 'animate-pulse' : ''}`}>
                        {es.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={9} /> hace {exp.dias}d
                      </span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-400 shrink-0" />
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <FolderOpen size={28} className="mb-3 opacity-40" />
                <p className="text-sm font-semibold text-slate-300">No hay expedientes recientes</p>
                <Link to="/expedientes/nuevo" className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all">
                  Crear primer expediente
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* â”€ Notificaciones SINOE (1/3) â”€ */}
        <motion.div variants={item} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-blue-400" />
              <h2 className="text-sm font-bold text-white">Monitor SINOE</h2>
            </div>
            <Link to="/monitor-sinoe" className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {loadingNotifs ? (
              <div className="flex items-center justify-center h-24">
                <span className="inline-block w-5 h-5 rounded-full border-2 border-white/10 border-t-white animate-spin" />
              </div>
            ) : notificaciones.length > 0 ? (
              notificaciones.map((notif) => (
                <motion.div
                  key={notif.id}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  className="flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    notif.tipo === 'urgente' ? 'bg-red-500' : notif.tipo === 'resolucion' ? 'bg-blue-500' : 'bg-slate-500'
                  } ${notif.tipo === 'urgente' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${notif.tipo === 'urgente' ? 'text-red-400' : 'text-slate-200'}`}>
                      {notif.titulo}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{notif.desc}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{notif.tiempo}</span>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Bell size={24} className="mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-300">No hay notificaciones pendientes</p>
              </div>
            )}
          </div>

          {/* IA Quick Panel */}
          <div className="p-4 border-t border-white/8 bg-violet-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-violet-400" />
              <span className="text-xs font-bold text-violet-400">Asistente IA</span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Consulta el estado de tus expedientes en la sección correspondiente.
            </p>
            <Link to="/chat-ia"
              className="mt-3 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-400 text-xs font-bold hover:bg-violet-500/25 transition-colors">
              <Zap size={12} /> Consultar ahora
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
