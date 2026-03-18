import Header from '../components/Header';

import AppIcon from '../components/AppIcon';
export default function ResumenEjecutivo() {
  return (
    <div className="page-enter">
      <Header title="Resumen Ejecutivo AI" showBack rightAction={<span className="badge badge-success">Gemini</span>} />
      <div className="px-4 py-6 space-y-6">
        <div className="card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AppIcon name="summarize" size={20} /></div><div><p className="font-bold">Exp. 04532-2023</p><p className="text-xs text-slate-400">Colusión Agravada</p></div></div></div>
        <div className="card bg-primary/5 border-primary/20 p-5 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2"><AppIcon name="auto_awesome" size={20} /> Resumen Generado por IA</h3>
          <div><h4 className="text-xs font-bold text-primary uppercase mb-1">Hechos Relevantes</h4><p className="text-xs text-slate-400 leading-relaxed">El imputado participó en el proceso de licitación del proyecto Puente Tarata III. Se detectaron comunicaciones previas entre funcionarios y el contratista ganador.</p></div>
          <div><h4 className="text-xs font-bold text-amber-400 uppercase mb-1">Puntos Débiles</h4><p className="text-xs text-slate-400 leading-relaxed">La cadena de custodia de las pruebas digitales presenta deficiencias. Los chats fueron extraídos sin autorización judicial previa.</p></div>
          <div><h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Recomendaciones</h4><p className="text-xs text-slate-400 leading-relaxed">Fortalecer la prueba documental y solicitar ratificación pericial. Considerar impugnar la admisión de pruebas digitales.</p></div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1 text-xs"><AppIcon name="picture_as_pdf" size={20} /> Exportar PDF</button>
          <button className="btn btn-primary flex-1 text-xs"><AppIcon name="share" size={20} /> Compartir</button>
        </div>
      </div>
    </div>
  );
}
