import { useEffect, useCallback } from 'react';

/**
 * Escucha atajos de teclado globales.
 * @param {string} key - Tecla (ej: 'k', 'Escape', 'Enter')
 * @param {Function} callback - Función a ejecutar
 * @param {{ ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean }} options
 */
export function useKeyboard(key, callback, options = {}) {
  const { ctrlKey = false, metaKey = false, shiftKey = false } = options;

  const handleKeyDown = useCallback((event) => {
    const matchKey = event.key === key || event.key === key.toLowerCase();
    const matchShift = !shiftKey || event.shiftKey;
    const matchModifier = ctrlKey || metaKey ? (event.ctrlKey || event.metaKey) : true;

    if (matchKey && matchModifier && matchShift) {
      event.preventDefault();
      callback(event);
    }
  }, [key, callback, ctrlKey, metaKey, shiftKey]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook simplificado para Cmd+K / Ctrl+K
 */
export function useCmdK(callback) {
  return useKeyboard('k', callback, { metaKey: true });
}

/**
 * Hook para tecla Escape
 */
export function useEscape(callback) {
  return useKeyboard('Escape', callback);
}
