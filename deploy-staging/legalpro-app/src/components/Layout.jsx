import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CommandPalette from './CommandPalette';
import ToastContainer from './ui/Toast';
import OnboardingTour from './onboarding/OnboardingTour';
import { useUI } from '../context/UIContext';
import { useTenant } from '../context/TenantContext';
import fondoImg from '../assets/backgrounds/fondo.jpeg';

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function Layout() {
  const location = useLocation();
  const { sidebarCollapsed } = useUI();
  const { usuario } = useTenant();
  const userRole = usuario?.rol ?? 'ABOGADO';
  const isChatRoute = location.pathname === '/chat-ia';

  return (
    <div className="min-h-dvh bg-[#0F172A]">
      {/* ─── SKIP-LINK (accesibilidad: navegación por teclado) ─── */}
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]
                   focus:px-4 focus:py-3 focus:bg-blue-600 focus:text-white focus:rounded-xl
                   focus:text-sm focus:font-bold focus:shadow-2xl focus:outline-none
                   transition-none">
        Saltar al contenido principal
      </a>

      {/* ─── GLOBAL BACKGROUND ─── */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img src={fondoImg} alt="" loading="lazy" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-linear-to-b from-[#0f172a]/90 via-[#0f172a]/95 to-[#0b0e14]" />
      </div>

      {/* ─── SIDEBAR (solo desktop) ─── */}
      <Sidebar />

      {/* ─── CONTENIDO PRINCIPAL ─── */}
      <div
        className={`layout-main-shell flex flex-col min-h-dvh min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* TopBar */}
        <TopBar />

        {/* Page content */}
        <motion.main
          id="main-content"
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`flex-1 min-h-0 ${
            isChatRoute
              ? 'flex flex-col overflow-hidden pb-0'
              : 'overflow-auto pb-24 lg:pb-0'
          }`}
          tabIndex={-1}
        >
          <Outlet />
        </motion.main>
      </div>

      {/* ─── BOTTOM NAV (solo móvil) ─── */}
      <BottomNav />

      {/* ─── PORTALES GLOBALES ─── */}
      <CommandPalette />
      <ToastContainer />

      {/* ─── ONBOARDING TOUR (primer acceso por rol) ─── */}
      <OnboardingTour role={userRole} />
    </div>
  );
}

