import { NavLink } from 'react-router-dom';
import AppIcon from './AppIcon';

const navItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Inicio' },
  { to: '/expedientes', icon: 'folder', label: 'Casos' },
  { to: '/chat-ia', icon: 'auto_awesome', label: 'IA Legal', isCenter: true },
  { to: '/herramientas', icon: 'build', label: 'Tools' },
  { to: '/perfil', icon: 'person', label: 'Perfil' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="flex justify-between items-center">
        {navItems.map(item => (
          item.isCenter ? (
            <NavLink key={item.to} to={item.to} className="relative -top-8 flex flex-col items-center group">
              <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-xl anim-pulse-glow group-hover:scale-110 group-hover:shadow-2xl"
                   style={{ boxShadow: '0 4px 24px rgba(99, 102, 241, 0.5)', transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                <AppIcon name={item.icon} size={28} />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 mt-1.5 transition-colors duration-300">{item.label}</span>
            </NavLink>
          ) : (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-400 ease-out ${isActive ? 'text-indigo-400 bg-indigo-500/10 scale-105' : 'text-slate-500 hover:text-slate-300 scale-100'}`}
              style={{ transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}>
              {({ isActive }) => (
                <>
                  <AppIcon name={item.icon} size={22} className={isActive ? 'icon-indigo' : 'icon-muted'} />
                  <span className={`text-[10px] transition-all duration-300 ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          )
        ))}
      </div>
    </nav>
  );
}
