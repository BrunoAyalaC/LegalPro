import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
const logoImg = '/landing/assets/img/logo-icon.jpeg';

const APK_URL = import.meta.env.VITE_APK_URL ?? null;

function DescargarAPK() {
  if (!APK_URL) return null;
  return (
    <a
      href={APK_URL}
      download="LegalPro.apk"
      className="glass flex items-center gap-3 p-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 mb-4 active:scale-[0.98] transition-transform"
    >
      <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
        <AppIcon name="android" size={26} className="text-cyan-400" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-sm text-cyan-300">Descarga la app Android</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Instala LegalPro en tu celular (APK)</p>
      </div>
      <div className="flex flex-col items-center shrink-0">
        <AppIcon name="download" size={22} className="text-cyan-400" />
        <span className="text-[9px] text-cyan-500 font-bold uppercase mt-0.5">Gratis</span>
      </div>
    </a>
  );
}

export default function Perfil() {
  const menuItems = [
    { icon: 'person', label: 'Datos Personales', desc: 'Nombre, colegiatura, especialidad' },
    { icon: 'tune', label: 'Especialidad Legal', desc: 'Configura tu área de práctica' },
    { icon: 'notifications', label: 'Notificaciones', desc: 'Alertas y recordatorios' },
    { icon: 'security', label: 'Seguridad', desc: 'Contraseña y 2FA' },
    { icon: 'auto_awesome', label: 'Configuración IA', desc: 'Modelo Gemini y preferencias' },
    { icon: 'download', label: 'Exportar Datos', desc: 'Backup de expedientes' },
    { icon: 'help', label: 'Soporte', desc: 'Ayuda y documentación' },
  ];

  return (
    <div className="page-enter">
      <Header title="Mi Perfil" />

      <div className="px-4 py-6">
        {/* Profile Card */}
        <div className="glass text-center mb-6 p-6 rounded-3xl border border-white/5 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}>
            <img src={logoImg} alt="LegalPro" className="w-14 h-14 object-contain" style={{ filter: 'none' }} />
          </div>
          <h2 className="text-lg font-bold">Dr. Carlos García Mendoza</h2>
          <p className="text-sm text-slate-400">Abogado Penalista</p>
          <div className="flex justify-center gap-2 mt-3">
            <span className="badge badge-primary">CAL-12345</span>
            <span className="badge badge-success">Activo</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/5">
            <div><p className="text-lg font-bold">5</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Casos</p></div>
            <div><p className="text-lg font-bold">23</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Consultas IA</p></div>
            <div><p className="text-lg font-bold">12</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Escritos</p></div>
          </div>
        </div>

        {/* Descarga APK Android */}
        <DescargarAPK />

        {/* Menu */}
        <div className="space-y-2">
          {menuItems.map((item, i) => (
            <button key={i} className="glass w-full flex items-center gap-3 text-left active:scale-[0.98] transition-transform p-3 group border border-white/5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <AppIcon name={item.icon} size={22} className="icon-indigo" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-[11px] text-slate-500">{item.desc}</p>
              </div>
              <AppIcon name="chevron_right" size={18} className="icon-muted group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          ))}
        </div>

        <button className="w-full mt-6 py-3 rounded-xl text-red-400 font-semibold text-sm border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 transition-colors">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
