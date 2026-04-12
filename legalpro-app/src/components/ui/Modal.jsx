import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

const panelVariants = {
  initial: { opacity: 0, scale: 0.94, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] } },
  exit:    { opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.2 } },
};

const sizes = {
  sm:         'max-w-sm',
  md:         'max-w-md',
  lg:         'max-w-lg',
  xl:         'max-w-xl',
  '2xl':      'max-w-2xl',
  '3xl':      'max-w-3xl',
  fullscreen: 'max-w-[95vw] max-h-[95vh]',
};

export default function Modal({
  open = false,
  onClose,
  title,
  subtitle,
  icon: Icon,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
  className = '',
}) {
  const panelRef = useRef(null);

  /* Cerrar con Esc */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Lock scroll */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  /* Focus trap */
  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable[0]?.focus();
    }
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-label={title}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => closeOnOverlay && onClose?.()}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`
              relative w-full ${sizes[size] ?? sizes.md}
              bg-slate-900/95 backdrop-blur-2xl
              border border-white/15 rounded-3xl
              shadow-2xl shadow-black/60
              flex flex-col max-h-[90vh]
              ${className}
            `}
          >
            {/* Header */}
            {(title || Icon) && (
              <div className="flex items-start gap-4 p-6 border-b border-white/8 shrink-0">
                {Icon && (
                  <div className="p-2.5 bg-blue-500/15 rounded-xl border border-blue-500/20 shrink-0">
                    <Icon size={20} className="text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
                  {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar modal"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/8 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
