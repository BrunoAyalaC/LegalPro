import { useState, useEffect, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import Button from '../ui/Button';

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

const panelVariants = {
  initial: { opacity: 0, scale: 0.92, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] } },
  exit:    { opacity: 0, scale: 0.95, y: 12, transition: { duration: 0.2 } },
};

const shakeVariants = {
  shake: {
    x: [0, -8, 8, -6, 6, -4, 4, 0],
    transition: { duration: 0.4 },
  },
};

/**
 * ConfirmModal — Modal de confirmación con soporte para acciones destructivas.
 *
 * Se conecta automáticamente al UIContext → useUI().confirm(options):
 *
 * const { confirm } = useUI();
 * const ok = await confirm({
 *   title:       'Eliminar expediente',
 *   description: 'Esta acción no se puede deshacer. El expediente y todos sus documentos serán eliminados permanentemente.',
 *   confirmText: 'Eliminar',
 *   danger:      true,
 *   requireWord: 'ELIMINAR',   // opcional: el usuario debe escribir esta palabra
 * });
 * if (ok) { ... }
 */
export default function ConfirmModal() {
  const { confirmModal, resolveConfirm } = useUI();

  const open        = confirmModal !== null;
  const title       = confirmModal?.title ?? 'Confirmar acción';
  const description = confirmModal?.description ?? '¿Estás seguro de que deseas continuar?';
  const confirmText = confirmModal?.confirmText ?? 'Confirmar';
  const danger      = confirmModal?.danger ?? false;
  const requireWord = confirmModal?.requireWord ?? null;

  const [typed, setTyped]     = useState('');
  const [shaking, setShaking] = useState(false);

  /* Reset al abrir */
  useEffect(() => {
    if (open) startTransition(() => setTyped(''));
  }, [open]);

  /* Esc */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') resolveConfirm(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, resolveConfirm]);

  const canConfirm = requireWord ? typed.trim().toUpperCase() === requireWord.toUpperCase() : true;

  function handleConfirm() {
    if (!canConfirm) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    resolveConfirm(true);
  }

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="confirm-overlay"
        variants={overlayVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={() => resolveConfirm(false)}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4
          bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          key="confirm-panel"
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-2xl
            border border-white/15 rounded-3xl shadow-2xl shadow-black/60 p-6"
        >
          {/* Botón cerrar */}
          <button
            onClick={() => resolveConfirm(false)}
            aria-label="Cancelar"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500
              hover:text-slate-300 hover:bg-white/8 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Icono */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto
            ${danger ? 'bg-red-500/15 border border-red-500/30' : 'bg-amber-500/15 border border-amber-500/30'}`}
          >
            {danger
              ? <Trash2 size={26} className="text-red-400" />
              : <AlertTriangle size={26} className="text-amber-400" />
            }
          </div>

          {/* Texto */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
          </div>

          {/* Campo de confirmación opcional */}
          {requireWord && (
            <motion.div
              animate={shaking ? 'shake' : 'rest'}
              variants={shakeVariants}
              className="mb-5"
            >
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Escribe{' '}
                <span className="font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                  {requireWord}
                </span>{' '}
                para confirmar
              </label>
              <input
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder={requireWord}
                autoFocus
                className="w-full h-10 px-4 rounded-xl bg-white/5 border border-white/15
                  text-slate-200 placeholder-slate-500 text-sm font-mono
                  focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50
                  transition-all duration-200"
              />
            </motion.div>
          )}

          {/* Acciones */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => resolveConfirm(false)}
            >
              Cancelar
            </Button>
            <Button
              variant={danger ? 'danger' : 'primary'}
              className={`flex-1 ${danger ? 'bg-red-600/80 hover:bg-red-600 text-white border-red-500/50' : ''}`}
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
