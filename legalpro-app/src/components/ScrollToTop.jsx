import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — restaura el scroll al cambiar de ruta (UX fluides).
 * FIX UX (2026-08-23): sin esto, navegar desde una página larga dejaba
 * la nueva vista a mitad de scroll.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
}
