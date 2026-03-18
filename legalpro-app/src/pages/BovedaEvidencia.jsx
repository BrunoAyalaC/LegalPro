import Header from '../components/Header';

import AppIcon from '../components/AppIcon';
export default function BovedaEvidencia() {
  const evidencias = [
    { name: 'Captura WhatsApp - Chat 01', tipo: 'imagen', size: '2.4 MB', hash: 'SHA-256: a1b2c3...', fecha: '01/03/2026', verificado: true },
    { name: 'Correo electrónico - Licitación', tipo: 'documento', size: '1.1 MB', hash: 'SHA-256: d4e5f6...', fecha: '28/02/2026', verificado: true },
    { name: 'Video de vigilancia CCTV', tipo: 'video', size: '45 MB', hash: 'SHA-256: g7h8i9...', fecha: '25/02/2026', verificado: false },
  ];
  const iconMap = { imagen: 'image', documento: 'description', video: 'videocam' };
  return (
    <div className="page-enter">
      <Header title="Bóveda de Evidencia" showBack rightAction={<AppIcon name="security" size={20} />} />
      <div className="px-4 py-6 space-y-6">
        <div className="card bg-emerald-500/10 border-emerald-500/20 flex items-center gap-3 p-4">
          <AppIcon name="verified_user" size={20} />
          <div><p className="font-bold text-sm text-emerald-400">Cadena de Custodia Intacta</p><p className="text-xs text-slate-400">{evidencias.filter(e => e.verificado).length}/{evidencias.length} evidencias verificadas</p></div>
        </div>
        <div className="space-y-3">
          {evidencias.map((e, i) => (
            <div key={i} className="card anim-fade-in-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AppIcon name={iconMap[e.tipo]} size={20} /></div>
                <div className="flex-1"><p className="font-semibold text-sm">{e.name}</p><p className="text-[10px] text-slate-500">{e.size} • {e.fecha}</p><p className="text-[9px] text-slate-600 font-mono mt-1">{e.hash}</p></div>
                <AppIcon name={e.verificado ? 'check_circle' : 'pending'} size={20} />
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary w-full"><AppIcon name="upload" size={20} /> Agregar Evidencia</button>
      </div>
    </div>
  );
}
