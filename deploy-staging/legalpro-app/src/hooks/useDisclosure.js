import { useState, useCallback } from 'react';

/**
 * Estado y control para modales / drawers.
 * @param {boolean} initialState
 */
export function useDisclosure(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open  = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((s) => !s), []);

  return { isOpen, open, close, toggle };
}
