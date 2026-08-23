import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const widths = {
  sm:  'max-w-sm',
  md:  'max-w-md',
  lg:  'max-w-lg',
  xl:  'max-w-xl',
};

const slideVariants = {
  right: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0,      opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:    { x: '100%', opacity: 0, transition: { duration: 0.22 } },
  },
  left: {
    initial: { x: '-100%', opacity: 0 },
    animate: { x: 0,       opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:    { x: '-100%', opacity: 0, transition: { duration: 0.22 } },
  },
  bottom: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0,      opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:    { y: '100%', opacity: 0, transition: { duration: 0.22 } },
  },
};

export default function Drawer({
  open = false,
  onClose,
  title,
  subtitle,
  icon: Icon,
  side = 'right',
  size = 'md',
  children,
  footer,
  className = '',
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isBottom = side === 'bottom';
  const positionClass = {
    right:  'top-0 right-0 h-full',
    left:   'top-0 left-0 h-full',
    bottom: 'bottom-0 left-0 w-full',
  }[side];

  const v = slideVariants[side] ?? slideVariants.right;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={v.initial}
            animate={v.animate}
            exit={v.exit}
            className={`
              absolute ${positionClass}
              ${isBottom ? 'max-h-[90vh] rounded-t-3xl' : `${widths[size] ?? widths.md} w-full rounded-l-3xl`}
              bg-slate-900/98 backdrop-blur-2xl
              border border-white/12
              shadow-2xl shadow-black/60
              flex flex-col
              ${className}
            `}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-white/8 shrink-0">
              {Icon && (
                <div className="p-2 bg-blue-500/15 rounded-xl border border-blue-500/20">
                  <Icon size={18} className="text-blue-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {title && <h3 className="text-base font-bold text-white leading-tight">{title}</h3>}
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar panel"
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 min-h-0">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 p-5 border-t border-white/8 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
