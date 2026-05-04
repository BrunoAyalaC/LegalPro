import { useState, useEffect } from 'react';

/**
 * Detecta breakpoints responsive.
 * @param query - Media query CSS
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/* Breakpoints LegalPro */
export function useIsMobile(): boolean  { return useMediaQuery('(max-width: 639px)'); }
export function useIsTablet(): boolean  { return useMediaQuery('(min-width: 640px) and (max-width: 1023px)'); }
export function useIsDesktop(): boolean { return useMediaQuery('(min-width: 1024px)'); }
