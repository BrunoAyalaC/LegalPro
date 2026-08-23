import Header from '../components/Header';
import AppIcon from '../components/AppIcon';

export default function Recordatorios() {
  return (
    <div className="page-enter">
      <Header title="Recordatorios" showBack rightAction={
        <div className="flex gap-1">
          <span className="badge badge-success">Online</span>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><AppIcon name="refresh" size={20} /></button>
        </div>
      } />
      <div className="px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-primary">0</p><p className="text-[10px] text-slate-400 uppercase">Nuevas</p></div>
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-red-400">0</p><p className="text-[10px] text-slate-400 uppercase">Urgentes</p></div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Notificaciones Recientes</h3>
          <div className="card flex flex-col items-center justify-center py-12 text-center anim-fade-in-up">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <AppIcon name="notifications_none" size={24} />
            </div>
            <p className="text-sm font-semibold text-white mb-2">Sistema de alertas basado en tus propios expedientes</p>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Los recordatorios aparecerán cuando registres fechas de vencimiento en tus casos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
