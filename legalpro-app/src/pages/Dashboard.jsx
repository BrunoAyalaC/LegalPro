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

/* â”€â”€ Datos de ejemplo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ACTIVITY_DATA = [
  { mes: 'Oct', nuevos: 8, resueltos: 5, proceso: 14 },
  { mes: 'Nov', nuevos: 12, resueltos: 9, proceso: 17 },
  { mes: 'Dic', nuevos: 6, resueltos: 11, proceso: 12 },
  { mes: 'Ene', nuevos: 15, resueltos: 8, proceso: 19 },
  { mes: 'Feb', nuevos: 10, resueltos: 13, proceso: 16 },
  { mes: 'Mar', nuevos: 18, resueltos: 14, proceso: 22 },
];

const MATERIA_DATA = [
  { name: 'Civil',          value: 35, color: '#3B82F6' },
  { name: 'Penal',          value: 25, color: '#EF4444' },
  { name: 'Laboral',        value: 20, color: '#F59E0B' },
  { name: 'Constitucional', value: 10, color: '#8B5CF6' },
  { name: 'Familia',        value: 10, color: '#EC4899' },
];

const EXPEDIENTES_RECIENTES = [
  { num: '04532-2023', materia: 'Civil',   titulo: 'Demanda por DaÃ±os y Perjuicios',       estado: 'urgente',   actores: 'GarcÃ­a vs. Constructora LP', dias: 1 },
  { num: '01287-2024', materia: 'Penal',   titulo: 'Recurso de ApelaciÃ³n â€” Fraude',        estado: 'pendiente', actores: 'MP vs. RamÃ­rez Torres',      dias: 5 },
  { num: '00891-2024', materia: 'Laboral', titulo: 'Cese de Hostilidades Laborales',       estado: 'activo',    actores: 'Mendoza vs. PerÃº SAC',       dias: 12 },
  { num: '02201-2024', materia: 'Civil',   titulo: 'Nulidad de Acto JurÃ­dico',             estado: 'activo',    actores: 'Flores vs. NotarÃ­a Castro',  dias: 20 },
  { num: '03387-2023', materia: 'Familia', titulo: 'Tenencia y RÃ©gimen de Visitas',        estado: 'archivado', actores: 'Paredes vs. Romero',         dias: 45 },
];

const NOTIFICACIONES = [
  { id: 1, titulo: 'PLAZO VENCE MAÃ‘ANA',   desc: 'ApelaciÃ³n Exp. 04532-2023',       tipo: 'urgente',   tiempo: '5m' },
  { id: 2, titulo: 'Nueva ResoluciÃ³n',      desc: 'CasaciÃ³n NÂ° 2841-2024 admitida',  tipo: 'resolucion',tiempo: '1h' },
  { id: 3, titulo: 'ActualizaciÃ³n Normativa', desc: 'Ley NÂ° 31751 â€” CÃ³digo Penal',  tipo: 'info',      tiempo: '3h' },
];

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
function KpiCard({ icon: Icon, label, value, trend, trendUp, accentColor, glowColor, to }) {
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
            {trend && (
              <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full
                ${trendUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend}
              </span>
            )}
          </div>
          <p className="text-2xl lg:text-3xl font-extrabold text-white mb-1">
            <CountUp end={value} duration={1.5} />
          </p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        </div>
      </Link>
    </motion.div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  DASHBOARD PRINCIPAL                                       */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function Dashboard() {
  const { usuario, organizacion } = useTenant();
  const [stats, setStats] = useState({ civiles: 0, penales: 0, total: 0, urgentes: 0, laborales: 0, constitucionales: 0, familia: 0 });

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(() => setStats({ civiles: 28, penales: 12, total: 47, urgentes: 3, laborales: 5, constitucionales: 2, familia: 4 }));
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={FolderOpen}    label="Expedientes Activos" value={stats.total || 47}             trend="+12%" trendUp to="/expedientes" accentColor="bg-blue-500/15 text-blue-400"    glowColor="bg-blue-500/20" />
        <KpiCard icon={AlertTriangle} label="Vencen Esta Semana"  value={stats.urgentes || 3}           trend="â†‘ Urgente" trendUp={false} to="/expedientes" accentColor="bg-red-500/15 text-red-400" glowColor="bg-red-500/20" />
        <KpiCard icon={FileText}      label="Escritos Este Mes"   value={12}                             trend="+3 con IA" trendUp to="/redactor" accentColor="bg-violet-500/15 text-violet-400" glowColor="bg-violet-500/20" />
        <KpiCard icon={CheckCircle2}  label="Tasa de Ã‰xito"       value={89} trend="+2%"  trendUp accentColor="bg-emerald-500/15 text-emerald-400" glowColor="bg-emerald-500/20" />
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
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Nuevos</span>
              <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Resueltos</span>
              <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />En proceso</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ACTIVITY_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
        </motion.div>

        {/* â”€ DistribuciÃ³n por materia (1/3) â”€ */}
        <motion.div variants={item} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
          <h2 className="text-base font-bold text-white mb-1">Por Materia</h2>
          <p className="text-xs text-slate-400 mb-5">Distribución actual</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={MATERIA_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                {MATERIA_DATA.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {MATERIA_DATA.map((m) => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                  <span className="text-xs text-slate-400">{m.name}</span>
                </div>
                <span className="text-xs font-bold text-white">{m.value}%</span>
              </div>
            ))}
          </div>
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
            {EXPEDIENTES_RECIENTES.map((exp, i) => {
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
            })}
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
            {NOTIFICACIONES.map((notif) => (
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
            ))}
          </div>

          {/* IA Quick Panel */}
          <div className="p-4 border-t border-white/8 bg-violet-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-violet-400" />
              <span className="text-xs font-bold text-violet-400">Asistente IA</span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Tienes 3 expedientes que requieren atenciÃ³n urgente en los prÃ³ximos 2 dÃ­as.
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
