import { useState, useEffect } from 'react';

/**
 * Retrasa la actualización de un valor hasta que deja de cambiar.
 * @param value - Valor a debounce
 * @param delay - Milisegundos de espera (default 350ms)
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
