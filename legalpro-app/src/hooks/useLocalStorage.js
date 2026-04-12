import { useState, useCallback } from 'react';

/**
 * Sincroniza estado con localStorage.
 * @param {string} key - Clave en localStorage
 * @param {*} initialValue - Valor por defecto
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {
      // silencioso en producción
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch {
      // silencioso en producción
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
