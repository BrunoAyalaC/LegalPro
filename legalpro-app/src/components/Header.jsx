import { useNavigate } from 'react-router-dom';
import AppIcon from './AppIcon';

export default function Header({ title, subtitle, showBack = false, rightAction = null }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 glass px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all duration-300">
            <AppIcon name="arrow_back" size={22} />
          </button>
        )}
        <div>
          {subtitle && <p className="text-[11px] text-slate-400 font-medium tracking-wide">{subtitle}</p>}
          <h1 className="text-[17px] font-bold tracking-tight leading-tight">{title}</h1>
        </div>
      </div>
      {rightAction && <div className="flex gap-2">{rightAction}</div>}
    </header>
  );
}
