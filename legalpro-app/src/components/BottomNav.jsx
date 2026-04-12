import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Sparkles, Wrench, User } from 'lucide-react';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Inicio' },
  { to: '/expedientes',  icon: FolderOpen,      label: 'Casos' },
  { to: '/chat-ia',      icon: Sparkles,        label: 'IA Legal', isCenter: true },
  { to: '/herramientas', icon: Wrench,           label: 'Tools' },
  { to: '/perfil',       icon: User,             label: 'Perfil' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="flex justify-between items-center">
        {navItems.map(item => {
          const Icon = item.icon;
          return item.isCenter ? (
            <NavLink key={item.to} to={item.to} className="relative -top-8 flex flex-col items-center group">
              <div
                className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600
                  text-white flex items-center justify-center shadow-xl anim-pulse-glow
                  group-hover:scale-110 group-hover:shadow-2xl
                  border border-white/20 icon-shadow-indigo"
                style={{ transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                <Icon size={26} strokeWidth={2.2} />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 mt-1.5 transition-colors duration-300">
                {item.label}
              </span>
            </NavLink>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-400 ease-out
                ${isActive
                  ? 'text-indigo-400 bg-indigo-500/10 scale-105'
                  : 'text-slate-400 hover:text-slate-300 scale-100'}`
              }
              style={{ transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    className={`transition-colors duration-300 ${
                      isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  <span className={`text-[10px] transition-all duration-300 ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
