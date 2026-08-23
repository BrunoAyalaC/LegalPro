import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessionFromCookie } from '../api/client';

/**
 * Landing — redirige a /landing/ o a /dashboard si hay sesión vía httpOnly cookie.
 * SECURITY P0 2026-08-21: NUNCA leer JWT de localStorage ni decodificar con atob
 * en cliente. La sesión se valida exclusivamente contra /api/auth/me (cookie).
 */
export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getSessionFromCookie();
        if (!cancelled && session?.token) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        // sin sesión — continuar a landing pública
      }
      if (!cancelled) window.location.replace('/landing/');
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-[#050508] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Cargando LexIA…</p>
    </div>
  );
}
