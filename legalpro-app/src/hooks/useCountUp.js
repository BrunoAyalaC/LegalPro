import { useState, useEffect, useRef } from 'react';

/**
 * Anima un número desde 0 hasta el valor objetivo.
 * Úsalo en KPIs y métricas del dashboard.
 * @param {number} end - Valor final
 * @param {number} duration - Duración en ms (default 1200)
 * @param {boolean} enabled - Activa la animación
 */
export function useCountUp(end, duration = 1200, enabled = true) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(end);
      return;
    }

    setCount(0);
    startTimeRef.current = null;

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      setCount(Math.round(easedProgress * end));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration, enabled]);

  return count;
}
