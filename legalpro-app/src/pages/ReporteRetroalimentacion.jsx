import Header from '../components/Header';

import AppIcon from '../components/AppIcon';
export default function ReporteRetroalimentacion() {
  return (
    <div className="page-enter">
      <Header title="Retroalimentación IA" showBack />
      <div className="px-4 py-6 space-y-6">
        <div className="card text-center p-6">
          <AppIcon name="rate_review" size={20} />
          <h2 className="text-lg font-bold">Tu Desempeño Legal</h2>
          <p className="text-xs text-slate-400 mt-1">Análisis basado en tus últimas 10 consultas</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-emerald-400">87%</p><p className="text-[10px] text-slate-400 uppercase">Precisión Legal</p></div>
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-primary">23</p><p className="text-[10px] text-slate-400 uppercase">Consultas/Mes</p></div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Áreas de Mejora</h3>
          {[
            { area: 'Fundamentación de plazos', score: 72, tip: 'Citar artículos específicos del CPC' },
            { area: 'Redacción de petitorios', score: 85, tip: 'Incluir montos y pretensiones claras' },
            { area: 'Estrategia procesal', score: 91, tip: 'Excelente uso de precedentes' },
          ].map((m, i) => (
            <div key={i} className="card anim-fade-in-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
              <div className="flex justify-between items-center mb-2"><span className="font-semibold text-sm">{m.area}</span><span className="font-bold text-sm">{m.score}%</span></div>
              <div className="w-full h-1.5 bg-surface-dark rounded-full overflow-hidden mb-2"><div className="h-full bg-primary rounded-full" style={{ width: `${m.score}%` }}></div></div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1"><AppIcon name="lightbulb" size={20} /> {m.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
