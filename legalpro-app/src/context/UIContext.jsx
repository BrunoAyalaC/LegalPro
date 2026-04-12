import { createContext, useContext, useState, useCallback, useRef } from 'react';

const UIContext = createContext(null);

let toastId = 0;

export function UIProvider({ children }) {
  // ── Toasts ──────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type = 'info', duration = 4000, action }) => {
    const id = ++toastId;
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration, action }]);
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, opts) => addToast({ message: msg, type: 'success', ...opts }),
    error:   (msg, opts) => addToast({ message: msg, type: 'error',   ...opts }),
    warning: (msg, opts) => addToast({ message: msg, type: 'warning', ...opts }),
    info:    (msg, opts) => addToast({ message: msg, type: 'info',    ...opts }),
    ai:      (msg, opts) => addToast({ message: msg, type: 'ai',      ...opts }),
  };

  // ── Command Palette ──────────────────────────────────────
  const [commandOpen, setCommandOpen] = useState(false);
  const openCommand  = useCallback(() => setCommandOpen(true),  []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  // ── Modal global (confirm) ───────────────────────────────
  const [confirmModal, setConfirmModal] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, description, confirmText = 'Confirmar', danger = false }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmModal({ title, description, confirmText, danger });
    });
  }, []);

  const resolveConfirm = useCallback((result) => {
    resolveRef.current?.(result);
    setConfirmModal(null);
  }, []);

  // ── Sidebar collapsed state ──────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('lp_sidebar') === 'collapsed'; } catch { return false; }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('lp_sidebar', next ? 'collapsed' : 'expanded'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <UIContext.Provider value={{
      toasts, addToast, removeToast, toast,
      commandOpen, openCommand, closeCommand,
      confirmModal, confirm, resolveConfirm,
      sidebarCollapsed, toggleSidebar,
    }}>
      {children}
    </UIContext.Provider>
  );
}

/* eslint-disable-next-line react-refresh/only-export-components */
export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI debe usarse dentro de UIProvider');
  return ctx;
}
