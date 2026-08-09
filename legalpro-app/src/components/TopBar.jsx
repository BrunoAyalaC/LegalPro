import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Bell, ChevronRight, Sparkles } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useTenant } from '../context/TenantContext';
import { fixUtf8Mojibake } from '../utils/utf8';
import { IA_ACTIVE_PROVIDER_ID, getProviderLabel } from '../api/client';

const BREADCRUMB_MAP = {
  '/dashboard':          ['Dashboard'],
  '/expedientes':        ['Expedientes'],
  '/chat-ia':            ['IA Legal', 'Chat IA'],
  '/analista':           ['IA Legal', 'Analista de Expedientes'],
  '/redactor':           ['IA Legal', 'Redactor Legal'],
  '/simulador':          ['IA Legal', 'Simulador de Juicios'],
  '/predictor':          ['IA Legal', 'Predictor Judicial'],
  '/alegatos':           ['IA Legal', 'Alegatos de Clausura'],
  '/interrogatorio':     ['IA Legal', 'Interrogatorio NCPP'],
  '/objeciones':         ['IA Legal', 'Objeciones en Vivo'],
  '/monitor-sinoe':      ['Sistema', 'Monitor SINOE'],
  '/buscador':           ['Sistema', 'Jurisprudencia'],
  '/comparador':         ['Sistema', 'Comparador Precedentes'],
  '/boveda':             ['Sistema', 'Bóveda Evidencia'],
  '/multidoc':           ['Sistema', 'Gestión Multidoc'],
  '/resumen-ejecutivo':  ['Sistema', 'Resumen Ejecutivo'],
  '/herramientas':       ['Cuenta', 'Herramientas'],
  '/config-especialidad':['Cuenta', 'Especialidad Legal'],
  '/creditos':           ['Cuenta', 'Mis Créditos'],
  '/perfil':             ['Cuenta', 'Mi Perfil'],
  '/casos-criticos':     ['IA Legal', 'Casos Críticos'],
  '/retroalimentacion':  ['IA Legal', 'Retroalimentación'],
};

export default function TopBar() {
  const location = useLocation();
  const { openCommand } = useUI();
  const { usuario } = useTenant();

  const crumbs = BREADCRUMB_MAP[location.pathname] ?? [location.pathname.replace('/', '')];

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center px-4 lg:px-6 gap-3
                 bg-[#0F172A]/85 backdrop-blur-xl border-b border-white/8
                 shadow-sm shadow-black/20"
    >
      {/* Breadcrumb */}
      <nav aria-label="Ruta actual" className="flex-1 min-w-0 hidden sm:flex items-center gap-1.5">
        <span className="text-xs text-slate-400 font-medium">LegalPro</span>
        {crumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-slate-400" />
            <span className={`text-xs font-medium ${idx === crumbs.length - 1 ? 'text-slate-200' : 'text-slate-400'}`}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Spacer on mobile */}
      <div className="flex-1 sm:hidden" />

      {/* Badge IA Provider activo (single source of truth en client.ts) */}
      <IAProviderBadge />

      {/* Buscador global (Cmd+K) */}
      <motion.button
        onClick={openCommand}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-xl
                   bg-white/5 border border-white/10 hover:border-white/20
                   text-slate-500 hover:text-slate-300 transition-all duration-200
                   text-sm w-56"
        aria-label="Abrir búsqueda (Ctrl+K)"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/8 border border-white/12 rounded text-slate-400">
          ⌘K
        </kbd>
      </motion.button>

      {/* Notificaciones */}
      <NotifButton />

      {/* Avatar usuario */}
      <Link
        to="/perfil"
        aria-label="Ir a perfil"
        className="flex items-center gap-2.5 group"
      >
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-violet-600
                        flex items-center justify-center text-white text-xs font-bold
                        ring-2 ring-white/10 group-hover:ring-blue-500/40 transition-all">
          {(usuario?.nombreCompleto || usuario?.nombre || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="hidden xl:block text-left">
          <p className="text-xs font-semibold text-white leading-tight">
            {fixUtf8Mojibake(usuario?.nombreCompleto || usuario?.nombre || 'Usuario')}
          </p>
          <p className="text-xs text-slate-400 capitalize">
            {usuario?.rol?.toLowerCase() || 'abogado'}
          </p>
        </div>
      </Link>
    </header>
  );
}

/**
 * Badge IA Provider activo — modelo visible en el header para reforzar la
 * confianza del usuario sobre QUÉ modelo está respondiendo.
 *
 * La etiqueta y el proveedor se derivan de constantes en `src/api/client.ts`
 * (single source of truth). NO hardcodear strings aquí — si se cambia el
 * proveedor en `iaProviders.js`, este badge se actualiza automáticamente.
 */
function IAProviderBadge() {
  const label = getProviderLabel(IA_ACTIVE_PROVIDER_ID);
  return (
    <div
      className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                 bg-violet-500/10 border border-violet-500/25 text-violet-200
                 hover:bg-violet-500/15 transition-colors"
      title={`IA activa: ${label}`}
      aria-label={`Modelo IA activo: ${label}`}
      data-testid="ia-provider-badge"
    >
      <Sparkles size={11} aria-hidden="true" />
      <span className="text-[10px] font-bold tracking-wide whitespace-nowrap">{label}</span>
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
      </span>
    </div>
  );
}

function NotifButton() {
  const { toast } = useUI();
  const navigate = useNavigate();

  const handleClick = () => {
    // El sistema de notificaciones ya está implementado en /monitor-sinoe
    navigate('/monitor-sinoe');
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-slate-200 transition-colors"
      aria-label="Notificaciones"
    >
      <Bell size={18} />
    </motion.button>
  );
}
