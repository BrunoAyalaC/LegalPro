import Header from '../components/Header';

import AppIcon from '../components/AppIcon';
export default function GestionMultidoc() {
  return (
    <div className="page-enter">
      <Header title="Expediente Multidoc" showBack rightAction={<AppIcon name="folder_copy" size={20} />} />
      <div className="px-4 py-6 space-y-6">
        <div className="card"><div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AppIcon name="folder_open" size={20} /></div><div><p className="font-bold text-sm">Exp. 04532-2023</p><p className="text-xs text-slate-400">15 documentos • 3 anexos</p></div></div></div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Documentos del Expediente</h3>
        {[
          { name: 'Escrito de Defensa', pages: 12, tipo: 'escrito' },
          { name: 'Resolución Admisoria', pages: 3, tipo: 'resolucion' },
          { name: 'Acta de Audiencia', pages: 8, tipo: 'acta' },
          { name: 'Dictamen Pericial', pages: 15, tipo: 'pericia' },
          { name: 'Recurso de Apelación', pages: 6, tipo: 'recurso' },
        ].map((d, i) => (
          <div key={i} className="card flex items-center gap-3 anim-fade-in-up" style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><AppIcon name="description" size={20} /></div>
            <div className="flex-1"><p className="font-semibold text-sm">{d.name}</p><p className="text-[10px] text-slate-500">{d.pages} páginas • {d.tipo}</p></div>
            <AppIcon name="more_vert" size={20} />
          </div>
        ))}
        <button className="btn btn-primary w-full"><AppIcon name="note_add" size={20} /> Agregar Documento</button>
      </div>
    </div>
  );
}
