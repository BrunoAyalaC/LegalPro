import Header from '../components/Header';

import AppIcon from '../components/AppIcon';
export default function ComparadorPrecedentes() {
  return (
    <div className="page-enter">
      <Header title="Comparador Precedentes" showBack rightAction={<span className="badge badge-primary">INDECOPI/TC</span>} />
      <div className="px-4 py-6 space-y-6">
        <div className="input flex items-center gap-2"><AppIcon name="search" size={20} /><input className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-slate-500" placeholder="Buscar precedente..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card border-primary/30 p-3"><h4 className="text-xs font-bold text-primary mb-2">Precedente A</h4><p className="text-[11px] text-slate-400">Casación 0432-2023 - Delitos contra el patrimonio</p><span className="badge badge-success mt-2">Favorable</span></div>
          <div className="card border-amber-500/30 p-3"><h4 className="text-xs font-bold text-amber-400 mb-2">Precedente B</h4><p className="text-[11px] text-slate-400">Casación 2933-2023 - Responsabilidad civil</p><span className="badge badge-warning mt-2">Neutral</span></div>
        </div>
        <div className="card bg-primary/5 border-primary/20 p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><AppIcon name="compare" size={20} /> Análisis Comparativo IA</h3>
          <p className="text-xs text-slate-400 leading-relaxed">Ambos precedentes coinciden en la interpretación del Art. 384 del CP sobre colusión. Sin embargo, difieren en el estándar probatorio requerido para acreditar el perjuicio patrimonial al Estado...</p>
        </div>
        <button className="btn btn-primary w-full"><AppIcon name="auto_awesome" size={20} /> Comparar con Gemini</button>
      </div>
    </div>
  );
}
