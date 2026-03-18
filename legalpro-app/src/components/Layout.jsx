import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import fondoImg from '../assets/backgrounds/fondo.jpeg';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* ─── GLOBAL FULL SCREEN BACKGROUND ─── */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img src={fondoImg} alt="Fondo Global" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-[#0f131a]/85 via-[#0f131a]/95 to-[#0b0e14]"></div>
      </div>

      <main key={location.pathname} className="flex-1 overflow-y-auto pb-28 page-transition">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
