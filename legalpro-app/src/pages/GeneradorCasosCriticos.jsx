import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import casosCriticosFondo from '../assets/backgrounds/casos_criticos_fondo.jpeg';

export default function GeneradorCasosCriticos() {
  return (
    <div className="page-enter">
      {/* ─── FULL SCREEN BACKGROUND ─── */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img src={casosCriticosFondo} alt="Fondo" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-[#0f131a]/80 via-[#0f131a]/95 to-[#0f131a]"></div>
      </div>

      <Header title="Casos Críticos" subtitle="Generador de Escenarios" showBack rightAction={<span className="badge badge-danger">IA</span>} />
      
      <div className="px-4 py-6 space-y-6">
        {/* Intro */}
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_8px_32px_rgba(249,115,22,0.4)] mx-auto mb-4 border border-white/20">
            <AppIcon name="dangerous" size={32} className="icon-raw" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Escenarios Críticos</h2>
          <p className="text-sm text-slate-400 leading-relaxed">Anticipa los peores escenarios posibles en tus expedientes y prepara planes de contingencia estratégicos apoyados por IA.</p>
        </div>

        {/* Scenarios List */}
        <div className="space-y-3 pt-2">
          {[
            { titulo: 'Rechazo de Prueba Clave', riesgo: 'Alto', desc: 'El juez declara inadmisible la prueba pericial informando defecto en la cadena de custodia', icon: 'error', color: 'badge-danger' },
            { titulo: 'Testigo Hostil', riesgo: 'Medio', desc: 'El testigo principal cambia su declaración durante el interrogatorio en juicio oral', icon: 'warning', color: 'badge-warning' },
            { titulo: 'Nulidad Procesal', riesgo: 'Alto', desc: 'Se detecta defecto formal en la notificación que podría llevar a la nulidad de lo actuado', icon: 'dangerous', color: 'badge-danger' },
          ].map((c, i) => (
            <div key={i} className="glass p-4 rounded-xl border border-white/5 shadow-lg relative overflow-hidden anim-fade-in-up group" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
              {c.riesgo === 'Alto' && <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -z-10 group-hover:bg-red-500/20 transition-colors"></div>}
              
              <div className="flex items-start gap-3 mb-3">
                <div className={`mt-0.5 ${c.riesgo === 'Alto' ? 'text-red-400' : 'text-amber-400'}`}>
                   <AppIcon name={c.icon} size={22} className="icon-raw" style={{ filter: 'brightness(0) saturate(100%) invert(56%) sepia(97%) saturate(2000%) hue-rotate(220deg) brightness(100%)' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{c.titulo}</span>
                    <span className={`badge ${c.color}`}>{c.riesgo}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{c.desc}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                <button className="flex-1 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5">
                  <AppIcon name="auto_awesome" size={16} className="icon-indigo" /> 
                  Plan Contingencia
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <button className="w-full py-4 rounded-xl border border-dashed border-slate-600 text-slate-400 font-semibold hover:border-indigo-500 hover:text-indigo-400 transition-colors flex justify-center items-center gap-2">
          <AppIcon name="add" size={20} className="icon-muted" /> 
          Evaluación de Nuevo Escenario
        </button>
      </div>
    </div>
  );
}
