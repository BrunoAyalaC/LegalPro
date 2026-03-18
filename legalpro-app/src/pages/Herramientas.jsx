import { Link } from 'react-router-dom';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';

const herramientas = [
  { to: '/analista', icon: 'analytics', title: 'Analista de Expedientes', desc: 'Análisis IA de documentos judiciales', badge: 'IA', color: 'from-blue-600 to-indigo-700' },
  { to: '/simulador', icon: 'gavel', title: 'Simulador de Juicios', desc: 'Practica audiencias con IA', badge: 'IA', color: 'from-purple-600 to-pink-700' },
  { to: '/buscador', icon: 'search', title: 'Buscador Jurisprudencial', desc: 'Casaciones, amparos y precedentes', color: 'from-emerald-600 to-teal-700' },
  { to: '/redactor', icon: 'edit_document', title: 'Redactor Legal IA', desc: 'Genera escritos automáticamente', badge: 'IA', color: 'from-amber-600 to-orange-700' },
  { to: '/predictor', icon: 'trending_up', title: 'Predictor Judicial', desc: 'Predice resultados probables', badge: 'IA', color: 'from-cyan-600 to-blue-700' },
  { to: '/alegatos', icon: 'record_voice_over', title: 'Generador de Alegatos', desc: 'Alegatos de clausura con IA', badge: 'IA', color: 'from-rose-600 to-red-700' },
  { to: '/interrogatorio', icon: 'question_answer', title: 'Estrategia Interrogatorio', desc: 'Interrogatorio bajo NCPP', badge: 'IA', color: 'from-violet-600 to-purple-700' },
  { to: '/objeciones', icon: 'front_hand', title: 'Asistente Objeciones', desc: 'Objeciones en vivo en audiencia', badge: 'LIVE', color: 'from-red-600 to-rose-700' },
  { to: '/monitor-sinoe', icon: 'notifications_active', title: 'Monitor SINOE', desc: 'Notificaciones judiciales IA', color: 'from-indigo-600 to-blue-700' },
  { to: '/comparador', icon: 'compare', title: 'Comparador Precedentes', desc: 'Precedentes INDECOPI/TC', color: 'from-teal-600 to-emerald-700' },
  { to: '/boveda', icon: 'security', title: 'Bóveda Evidencia Digital', desc: 'Evidencia digital segura', color: 'from-slate-600 to-gray-700' },
  { to: '/multidoc', icon: 'folder_copy', title: 'Gestión Multidoc', desc: 'Expedientes multi-documento', color: 'from-sky-600 to-cyan-700' },
  { to: '/casos-criticos', icon: 'warning', title: 'Casos Críticos AI', desc: 'Generador de escenarios', badge: 'IA', color: 'from-orange-600 to-amber-700' },
  { to: '/resumen-ejecutivo', icon: 'summarize', title: 'Resumen Ejecutivo', desc: 'Resúmenes AI del caso', badge: 'IA', color: 'from-lime-600 to-green-700' },
  { to: '/retroalimentacion', icon: 'rate_review', title: 'Retroalimentación IA', desc: 'Reportes de mejora continua', color: 'from-fuchsia-600 to-pink-700' },
  { to: '/config-especialidad', icon: 'tune', title: 'Config. Especialidad', desc: 'Personaliza tu perfil legal', color: 'from-gray-600 to-slate-700' },
];

export default function Herramientas() {
  return (
    <div className="page-enter">
      <Header title="Herramientas Legales" rightAction={
        <span className="badge badge-success">{herramientas.filter(h => h.badge === 'IA').length} con IA</span>
      } />

      <div className="px-4 py-4">
        <p className="text-sm text-slate-400 mb-6">Suite completa de herramientas legales potenciadas por Gemini AI con Function Calling</p>
        
        <div className="grid grid-cols-2 gap-3">
          {herramientas.map((h, i) => (
            <Link key={i} to={h.to}
              className="glass relative overflow-hidden rounded-2xl p-4 transition-all active:scale-[0.97] anim-fade-in-up"
              style={{ animationDelay: `${i * 0.04}s`, opacity: 0 }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${h.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
              <div className="absolute inset-0 border border-white/5 rounded-2xl"></div>
              <div className="relative">
                {h.badge && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">{h.badge}</span>
                )}
                <AppIcon name={h.icon} size={30} className="mb-3 block" />
                <p className="font-bold text-sm leading-tight mb-1">{h.title}</p>
                <p className="text-[10px] text-slate-400 leading-snug">{h.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
