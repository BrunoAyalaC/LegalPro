import Header from '../components/Header';

import AppIcon from '../components/AppIcon';

export default function MonitorSinoe() {
  const notificaciones = [
    { exp: '04532-2023', titulo: 'Resolución N° 12 - Admisión de pruebas', tipo: 'Resolución', fecha: 'Hoy 10:30', urgente: true },
    { exp: '00123-2024', titulo: 'Notificación de audiencia programada', tipo: 'Cédula', fecha: 'Hoy 09:15', urgente: false },
    { exp: '02933-2023', titulo: 'Plazo para presentar alegatos vence', tipo: 'Plazo', fecha: 'Ayer', urgente: true },
    { exp: '01120-2022', titulo: 'Sentencia emitida por TC', tipo: 'Sentencia', fecha: '02/03/2026', urgente: false },
  ];

  return (
    <div className="page-enter">
      <Header title="Monitor SINOE IA" showBack rightAction={
        <div className="flex gap-1">
          <span className="badge badge-success">Online</span>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><AppIcon name="refresh" size={20} /></button>
        </div>
      } />
      <div className="px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-primary">{notificaciones.length}</p><p className="text-[10px] text-slate-400 uppercase">Nuevas</p></div>
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-red-400">{notificaciones.filter(n => n.urgente).length}</p><p className="text-[10px] text-slate-400 uppercase">Urgentes</p></div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Notificaciones Recientes</h3>
          {notificaciones.map((n, i) => (
            <div key={i} className={`card ${n.urgente ? 'border-l-4 border-red-500' : ''} anim-fade-in-up`} style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="badge badge-primary text-[9px]">{n.tipo}</span>
                <span className="text-[10px] text-slate-500">{n.fecha}</span>
              </div>
              <p className="font-semibold text-sm">{n.titulo}</p>
              <p className="text-xs text-slate-500 mt-1">Exp. {n.exp}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
