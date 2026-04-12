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

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* ─── GLOBAL BACKGROUND ─── */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img src={fondoImg} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-linear-to-b from-[#0f172a]/90 via-[#0f172a]/95 to-[#0b0e14]" />
      </div>

      {/* ─── SIDEBAR (solo desktop) ─── */}
      <Sidebar />

      {/* ─── CONTENIDO PRINCIPAL ─── */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[256px]'
        }`}
      >
        {/* TopBar */}
        <TopBar />

        {/* Page content */}
        <motion.main
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex-1 overflow-auto"
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

