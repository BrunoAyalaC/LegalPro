import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Redirige a la landing premium (videos, sprites, scroll-engine)
 * en public/landing/index.html — NO usar el JSX genérico anterior.
 */
export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('legalpro_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp || payload.exp * 1000 > Date.now()) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        localStorage.removeItem('legalpro_token');
      }
    }
    window.location.replace('/landing/');
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-[#050508] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Cargando LexIA…</p>
    </div>
  );
}
