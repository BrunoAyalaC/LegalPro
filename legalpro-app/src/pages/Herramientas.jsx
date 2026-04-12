import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, Scale, BookOpen, FileEdit, TrendingUp, Mic2,
  HelpCircle, Hand, Bell, GitCompare, Shield, FileStack,
  AlertTriangle, FileSearch, MessageSquareDot, Sliders,
} from 'lucide-react';

const herramientas = [
  { to: '/analista',      icon: BarChart3,          title: 'Analista de Expedientes', desc: 'Análisis IA de documentos judiciales', badge: 'IA',   glow: 'shadow-blue-500/25',    accent: 'bg-blue-500/15 text-blue-400',    gradient: 'from-blue-600/20 to-indigo-600/10' },
  { to: '/simulador',     icon: Scale,              title: 'Simulador de Juicios',    desc: 'Practica audiencias con IA',           badge: 'IA',   glow: 'shadow-purple-500/25',  accent: 'bg-purple-500/15 text-purple-400',gradient: 'from-purple-600/20 to-pink-600/10' },
  { to: '/buscador',      icon: BookOpen,            title: 'Buscador Jurisprudencial',desc: 'Casaciones, amparos y precedentes',   badge: null,   glow: 'shadow-emerald-500/25', accent: 'bg-emerald-500/15 text-emerald-400', gradient: 'from-emerald-600/20 to-teal-600/10' },
  { to: '/redactor',      icon: FileEdit,            title: 'Redactor Legal IA',       desc: 'Genera escritos automáticamente',     badge: 'IA',   glow: 'shadow-amber-500/25',   accent: 'bg-amber-500/15 text-amber-400', gradient: 'from-amber-600/20 to-orange-600/10' },
  { to: '/predictor',     icon: TrendingUp,          title: 'Predictor Judicial',      desc: 'Predice resultados probables',        badge: 'IA',   glow: 'shadow-cyan-500/25',    accent: 'bg-cyan-500/15 text-cyan-400',   gradient: 'from-cyan-600/20 to-blue-600/10' },
  { to: '/alegatos',      icon: Mic2,                title: 'Generador de Alegatos',   desc: 'Alegatos de clausura con IA',         badge: 'IA',   glow: 'shadow-rose-500/25',    accent: 'bg-rose-500/15 text-rose-400',   gradient: 'from-rose-600/20 to-red-600/10' },
  { to: '/interrogatorio',icon: HelpCircle,          title: 'Estrategia Interrogatorio', desc: 'Interrogatorio bajo NCPP',          badge: 'IA',   glow: 'shadow-violet-500/25',  accent: 'bg-violet-500/15 text-violet-400', gradient: 'from-violet-600/20 to-purple-600/10' },
  { to: '/objeciones',    icon: Hand,                title: 'Asistente Objeciones',    desc: 'Objeciones en vivo en audiencia',     badge: 'LIVE', glow: 'shadow-red-500/25',     accent: 'bg-red-500/15 text-red-400',     gradient: 'from-red-600/20 to-rose-600/10' },
  { to: '/monitor-sinoe', icon: Bell,                title: 'Monitor SINOE',           desc: 'Notificaciones judiciales IA',        badge: null,   glow: 'shadow-indigo-500/25',  accent: 'bg-indigo-500/15 text-indigo-400', gradient: 'from-indigo-600/20 to-blue-600/10' },
  { to: '/comparador',    icon: GitCompare,          title: 'Comparador Precedentes',  desc: 'Precedentes INDECOPI/TC',             badge: null,   glow: 'shadow-teal-500/25',    accent: 'bg-teal-500/15 text-teal-400',   gradient: 'from-teal-600/20 to-emerald-600/10' },
  { to: '/boveda',        icon: Shield,              title: 'Bóveda Evidencia Digital',desc: 'Evidencia digital segura',            badge: null,   glow: 'shadow-slate-500/25',   accent: 'bg-slate-500/15 text-slate-400', gradient: 'from-slate-600/20 to-gray-600/10' },
  { to: '/multidoc',      icon: FileStack,           title: 'Gestión Multidoc',        desc: 'Expedientes multi-documento',         badge: null,   glow: 'shadow-sky-500/25',     accent: 'bg-sky-500/15 text-sky-400',     gradient: 'from-sky-600/20 to-cyan-600/10' },
  { to: '/casos-criticos',icon: AlertTriangle,       title: 'Casos Críticos AI',       desc: 'Generador de escenarios',             badge: 'IA',   glow: 'shadow-orange-500/25',  accent: 'bg-orange-500/15 text-orange-400', gradient: 'from-orange-600/20 to-amber-600/10' },
  { to: '/resumen-ejecutivo', icon: FileSearch,      title: 'Resumen Ejecutivo',       desc: 'Resúmenes AI del caso',               badge: 'IA',   glow: 'shadow-lime-500/25',    accent: 'bg-lime-500/15 text-lime-400',   gradient: 'from-lime-600/20 to-green-600/10' },
  { to: '/retroalimentacion', icon: MessageSquareDot,title: 'Retroalimentación IA',    desc: 'Reportes de mejora continua',         badge: null,   glow: 'shadow-fuchsia-500/25', accent: 'bg-fuchsia-500/15 text-fuchsia-400', gradient: 'from-fuchsia-600/20 to-pink-600/10' },
  { to: '/config-especialidad', icon: Sliders,       title: 'Config. Especialidad',    desc: 'Personaliza tu perfil legal',         badge: null,   glow: 'shadow-gray-500/25',    accent: 'bg-gray-500/15 text-gray-400',   gradient: 'from-gray-600/20 to-slate-600/10' },
];

const container = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const item = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35 } },
};

export default function Herramientas() {
  const iaCount = herramientas.filter(h => h.badge === 'IA').length;

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="p-4 lg:p-6 max-w-7xl mx-auto pb-24 lg:pb-8"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-white">Herramientas Legales</h1>
          <p className="text-sm text-slate-400 mt-1">Suite completa potenciada por Gemini AI con Function Calling</p>
        </div>
        <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
          {iaCount} con IA
        </span>
      </motion.div>

      {/* Grid responsive: 2→3→4 columnas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {herramientas.map((h) => {
          const Icon = h.icon;
          return (
            <motion.div key={h.to} variants={item}>
              <Link
                to={h.to}
                className={`group relative block overflow-hidden rounded-2xl p-4 lg:p-5
                  backdrop-blur-xl bg-white/5 border border-white/10
                  hover:border-white/20 hover:bg-white/7
                  transition-all duration-300
                  shadow-lg hover:shadow-xl ${h.glow ? `hover:${h.glow}` : ''}`}
              >
                {/* Gradient bg accent */}
                <div className={`absolute inset-0 bg-linear-to-br ${h.gradient} opacity-60 pointer-events-none`} />
                <div className="absolute inset-0 border border-white/5 rounded-2xl pointer-events-none" />

                <div className="relative">
                  {/* Badge */}
                  {h.badge && (
                    <span className={`absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                      ${h.badge === 'LIVE' ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
                      {h.badge}
                    </span>
                  )}

                  {/* Icon con Shadow UI */}
                  <div className={`w-11 h-11 lg:w-12 lg:h-12 rounded-xl ${h.accent}
                    flex items-center justify-center mb-3
                    shadow-lg transition-all duration-300
                    group-hover:scale-110 group-hover:shadow-xl
                    border border-white/10`}
                  >
                    <Icon size={22} className="text-current" />
                  </div>

                  <p className="font-bold text-sm leading-tight mb-1 text-white">{h.title}</p>
                  <p className="text-xs text-slate-400 leading-snug">{h.desc}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
