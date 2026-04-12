import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Sliders, Bell, Shield, Sparkles, Download,
  HelpCircle, ChevronRight, LogOut, Building2
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';

const APK_URL = import.meta.env.VITE_APK_URL ?? null;

const container = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
const item = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35 } },
};

const MENU_ITEMS = [
  { icon: User,      label: 'Datos Personales',   desc: 'Nombre, colegiatura, especialidad', color: 'bg-blue-500/15 text-blue-400' },
  { icon: Sliders,   label: 'Especialidad Legal',  desc: 'Configura tu área de práctica',     color: 'bg-violet-500/15 text-violet-400' },
  { icon: Bell,      label: 'Notificaciones',      desc: 'Alertas y recordatorios',           color: 'bg-amber-500/15 text-amber-400' },
  { icon: Shield,    label: 'Seguridad',            desc: 'Contraseña y 2FA',                  color: 'bg-emerald-500/15 text-emerald-400' },
  { icon: Sparkles,  label: 'Configuración IA',     desc: 'Modelo Gemini y preferencias',      color: 'bg-indigo-500/15 text-indigo-400' },
  { icon: Download,  label: 'Exportar Datos',       desc: 'Backup de expedientes',             color: 'bg-cyan-500/15 text-cyan-400' },
  { icon: HelpCircle,label: 'Soporte',              desc: 'Ayuda y documentación',             color: 'bg-slate-500/15 text-slate-400' },
];

function DescargarAPK() {
  if (!APK_URL) return null;
  return (
    <motion.a
      variants={item}
      href={APK_URL}
      download="LegalPro.apk"
      className="flex items-center gap-3 p-4 rounded-2xl border border-cyan-500/30
        bg-cyan-500/5 backdrop-blur-xl mb-4 hover:bg-cyan-500/10 transition-all duration-300
        shadow-lg hover:shadow-cyan-500/15"
    >
      <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0
        shadow-lg shadow-cyan-500/20 border border-cyan-500/20">
        <Download size={24} className="text-cyan-400" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-sm text-cyan-300">Descarga la app Android</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Instala LegalPro en tu celular (APK)</p>
      </div>
      <div className="flex flex-col items-center shrink-0">
        <Download size={18} className="text-cyan-400" />
        <span className="text-xs text-cyan-500 font-bold uppercase mt-0.5">Gratis</span>
      </div>
    </motion.a>
  );
}

export default function Perfil() {
  const navigate = useNavigate();
  const { usuario, organizacion, logout } = useTenant();

  const nombreCompleto = usuario?.nombreCompleto || usuario?.nombre || 'Usuario';
  const iniciales = nombreCompleto.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase();
  const rol = usuario?.rol?.toLowerCase() || 'abogado';
  const especialidad = usuario?.especialidad || 'General';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="p-4 lg:p-6 max-w-2xl mx-auto pb-24 lg:pb-8"
    >
      {/* Profile Card */}
      <motion.div
        variants={item}
        className="text-center mb-6 p-6 rounded-3xl backdrop-blur-xl bg-white/5
          border border-white/10 shadow-2xl shadow-black/20 overflow-hidden relative"
      >
        {/* Glow bg */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div
            className="w-20 h-20 rounded-full bg-linear-to-br from-indigo-500 to-violet-600
              flex items-center justify-center mx-auto mb-3 shadow-xl overflow-hidden
              border-2 border-white/20"
            style={{ boxShadow: '0 8px 32px rgba(99, 102, 241, 0.35)' }}
          >
            <span className="text-2xl font-bold text-white">{iniciales}</span>
          </div>
          <h2 className="text-lg font-bold text-white">{nombreCompleto}</h2>
          <p className="text-sm text-slate-400 capitalize">{rol} · {especialidad}</p>

          <div className="flex justify-center gap-2 mt-3">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
              {usuario?.email || 'sin email'}
            </span>
            <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Activo
            </span>
          </div>

          {/* Organización */}
          {organizacion && (
            <div className="flex items-center justify-center gap-2 mt-4 px-4 py-2 mx-auto max-w-xs
              rounded-xl bg-white/5 border border-white/10">
              <Building2 size={14} className="text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-white">{organizacion.nombre}</span>
              <span className="text-xs text-slate-400">· Plan {organizacion.plan}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/8">
            <div>
              <p className="text-lg font-bold text-white">{organizacion?.expedientesUsados ?? '—'}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Casos</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">—</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Consultas IA</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">—</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Escritos</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Descarga APK Android */}
      <DescargarAPK />

      {/* Menu */}
      <div className="space-y-2">
        {MENU_ITEMS.map((menuItem, i) => {
          const Icon = menuItem.icon;
          return (
            <motion.button
              key={i}
              variants={item}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 text-left p-3.5 group
                backdrop-blur-xl bg-white/5 border border-white/10
                hover:bg-white/7 hover:border-white/20
                rounded-2xl transition-all duration-300 shadow-lg"
            >
              <div className={`w-10 h-10 rounded-xl ${menuItem.color} flex items-center justify-center
                shadow-lg border border-white/10 transition-transform duration-300
                group-hover:scale-110`}>
                <Icon size={20} className="text-current" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white">{menuItem.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{menuItem.desc}</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
            </motion.button>
          );
        })}
      </div>

      {/* Cerrar Sesión */}
      <motion.button
        variants={item}
        onClick={handleLogout}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
        className="w-full mt-6 py-3.5 rounded-xl text-red-400 font-semibold text-sm
          border border-red-500/25 bg-red-500/8 hover:bg-red-500/15
          transition-all duration-300 flex items-center justify-center gap-2
          shadow-lg hover:shadow-red-500/10"
      >
        <LogOut size={16} />
        Cerrar Sesión
      </motion.button>
    </motion.div>
  );
}
