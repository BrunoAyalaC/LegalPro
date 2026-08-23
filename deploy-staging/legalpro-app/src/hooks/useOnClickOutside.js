import { useEffect } from 'react';

/**
 * Ejecuta callback al hacer click fuera del elemento ref.
 * @param {React.RefObject} ref - Referencia al elemento
 * @param {Function} handler - Función a ejecutar al click fuera
 */
export function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
