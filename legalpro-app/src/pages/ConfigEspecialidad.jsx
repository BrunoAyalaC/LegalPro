import Header from '../components/Header';

import AppIcon from '../components/AppIcon';
export default function ConfigEspecialidad() {
  const especialidades = [
    { name: 'Derecho Penal', icon: 'gavel', active: true },
    { name: 'Derecho Civil', icon: 'balance', active: false },
    { name: 'Derecho Laboral', icon: 'work', active: false },
    { name: 'Derecho Constitucional', icon: 'account_balance', active: false },
    { name: 'Derecho de Familia', icon: 'family_restroom', active: false },
    { name: 'Derecho Administrativo', icon: 'apartment', active: false },
  ];
  return (
    <div className="page-enter">
      <Header title="Especialidad Legal" showBack />
      <div className="px-4 py-6 space-y-6">
        <p className="text-sm text-slate-400">Configura tu especialidad para que la IA personalice sus respuestas y herramientas.</p>
        <div className="space-y-3">
          {especialidades.map((e, i) => (
            <button key={i} className={`card w-full flex items-center gap-3 ${e.active ? 'border-primary/50 bg-primary/10' : ''} active:scale-[0.98] transition-transform`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${e.active ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                <AppIcon name={e.icon} size={20} />
              </div>
              <span className="font-semibold text-sm flex-1 text-left">{e.name}</span>
              {e.active && <AppIcon name="check_circle" size={20} />}
            </button>
          ))}
        </div>
        <button className="btn btn-primary w-full">Guardar Configuración</button>
      </div>
    </div>
  );
}
