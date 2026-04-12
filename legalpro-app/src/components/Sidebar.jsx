import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FolderOpen, MessageSquareDot,
  BarChart3, FileEdit, Scale, TrendingUp, BookOpen,
  Mic2, HelpCircle, Hand, Bell, GitCompare, Shield,
  FileStack, FileSearch, Wrench, Sliders,
  UserCircle, LogOut, ChevronLeft, ChevronRight,
  Building2
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';

const logoImg = '/landing/assets/img/logo-icon.jpeg';

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/expedientes', icon: FolderOpen,       label: 'Expedientes' },
      { to: '/chat-ia',     icon: MessageSquareDot, label: 'Chat IA Legal', badge: 'IA' },
    ],
  },
  {
    label: 'Herramientas IA',
    items: [
      { to: '/analista',      icon: BarChart3,   label: 'Analista de Expedientes' },
      { to: '/redactor',      icon: FileEdit,    label: 'Redactor Legal' },
      { to: '/simulador',     icon: Scale,       label: 'Simulador de Juicios' },
      { to: '/predictor',     icon: TrendingUp,  label: 'Predictor Judicial' },
      { to: '/alegatos',      icon: Mic2,        label: 'Alegatos de Clausura' },
      { to: '/interrogatorio',icon: HelpCircle,  label: 'Interrogatorio NCPP' },
      { to: '/objeciones',    icon: Hand,        label: 'Objeciones en Vivo' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/monitor-sinoe',     icon: Bell,        label: 'Monitor SINOE', badge: '3' },
      { to: '/buscador',          icon: BookOpen,    label: 'Jurisprudencia' },
      { to: '/comparador',        icon: GitCompare,  label: 'Comparador' },
      { to: '/boveda',            icon: Shield,      label: 'Bóveda Evidencia' },
      { to: '/multidoc',          icon: FileStack,   label: 'Gestión Multidoc' },
      { to: '/resumen-ejecutivo', icon: FileSearch,  label: 'Resumen Ejecutivo' },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { to: '/herramientas',        icon: Wrench,      label: 'Más Herramientas' },
      { to: '/config-especialidad', icon: Sliders,     label: 'Especialidad Legal' },
      { to: '/perfil',              icon: UserCircle,  label: 'Mi Perfil' },
    ],
  },
];

export default function Sidebar() {
  const { usuario, organizacion, logout } = useTenant();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUI();

  const handleLogout = () => { logout(); navigate('/login'); };
  const sidebarWidth = sidebarCollapsed ? 72 : 256;

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="hidden lg:flex flex-col fixed top-0 left-0 h-screen z-40 overflow-hidden
                 bg-[#1E293B]/95 backdrop-blur-xl border-r border-white/8 shadow-2xl shadow-black/30"
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/8 shrink-0">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-white/10">
          <img src={logoImg} alt="LegalPro" className="w-full h-full object-cover" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
              className="min-w-0 flex-1"
            >
              <p className="text-sm font-bold text-white leading-tight">LegalPro</p>
              <p className="text-xs text-blue-400 font-semibold tracking-wide">Perú · IA Legal</p>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={toggleSidebar}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          className={`p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors shrink-0 ${sidebarCollapsed ? 'mx-auto' : 'ml-auto'}`}
          aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </motion.button>
      </div>

      {/* ── Organización ── */}
      <AnimatePresence>
        {organizacion && !sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2.5 px-4 py-3 border-b border-white/6 bg-white/2 shrink-0 overflow-hidden"
          >
            <Building2 size={14} className="text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{organizacion.nombre}</p>
              <p className="text-xs text-slate-400 capitalize">{organizacion.plan}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navegación ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-1 scrollbar-none">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-2">
            {!sidebarCollapsed && (
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-400 select-none">
                {section.label}
              </p>
            )}
            {sidebarCollapsed && <div className="h-2" />}
            {section.items.map((item) => (
              <SidebarLink key={item.to} item={item} collapsed={sidebarCollapsed} />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Footer: Usuario ── */}
      <div className="border-t border-white/8 px-2 py-3 shrink-0">
        <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${!sidebarCollapsed ? 'bg-white/3' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-violet-600
                          flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(usuario?.nombreCompleto || usuario?.nombre || 'U').charAt(0).toUpperCase()}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[12px] font-bold text-white truncate">
                  {usuario?.nombreCompleto || usuario?.nombre || 'Usuario'}
                </p>
                <p className="text-xs text-slate-400 capitalize">
                  {usuario?.rol?.toLowerCase() || 'abogado'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!sidebarCollapsed && (
            <motion.button onClick={handleLogout} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors"
              aria-label="Cerrar sesión">
              <LogOut size={14} />
            </motion.button>
          )}
        </div>
        {sidebarCollapsed && (
          <button onClick={handleLogout}
            className="w-full flex justify-center mt-2 p-2 rounded-lg hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors"
            aria-label="Cerrar sesión">
            <LogOut size={14} />
          </button>
        )}
      </div>
    </motion.aside>
  );
}

function SidebarLink({ item, collapsed }) {
  const { icon: Icon, to, label, badge } = item;
  return (
    <NavLink to={to} className={({ isActive }) => `
      group relative flex items-center gap-3 py-2 px-3 rounded-xl text-sm
      transition-all duration-200 font-medium
      ${isActive ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
      ${collapsed ? 'justify-center px-2' : ''}
    `}>
      {({ isActive }) => (
        <>
          <Icon size={18} className={`shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                className="flex-1 truncate text-[13px]">
                {label}
              </motion.span>
            )}
          </AnimatePresence>
          {badge && !collapsed && (
            <span className="shrink-0 px-1.5 py-0.5 text-xs font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {badge}
            </span>
          )}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 text-xs font-semibold bg-slate-800 border border-white/12 rounded-lg text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-lg">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
