import { useEffect, useRef } from 'react';

/**
 * Mantiene el foco dentro de un contenedor modal.
 * Esencial para accesibilidad WCAG 2.1 AA.
 * @param {boolean} active - Si el trap está activo
 */
export function useFocusTrap(active = true) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelectors = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'textarea:not([disabled])', 'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusableElements = () =>
      Array.from(container.querySelectorAll(focusableSelectors));

    /* Auto-focus primer elemento */
    const firstEl = focusableElements()[0];
    if (firstEl) firstEl.focus();

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const elements = focusableElements();
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  return containerRef;
}
