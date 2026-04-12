import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, Sparkles, X } from 'lucide-react';
import { useUI } from '../../context/UIContext';

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
  ai:      Sparkles,
};

const STYLES = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  error:   'border-red-500/40    bg-red-500/10    text-red-400',
  warning: 'border-amber-500/40  bg-amber-500/10  text-amber-400',
  info:    'border-blue-500/40   bg-blue-500/10   text-blue-400',
  ai:      'border-violet-500/40 bg-violet-500/10 text-violet-400',
};

function ToastItem({ id, message, type = 'info', action, duration = 4000 }) {
  const { removeToast } = useUI();
  const Icon = ICONS[type] ?? Info;
  const style = STYLES[type] ?? STYLES.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: [0.34, 1.2, 0.64, 1] }}
      className={`
        relative flex items-start gap-3 min-w-[300px] max-w-sm
        p-4 rounded-2xl border backdrop-blur-xl
        shadow-2xl shadow-black/40
        bg-slate-900/95
        ${style}
        overflow-hidden
      `}
    >
      {/* Progress bar */}
      {duration > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-current opacity-40 rounded-full"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
        />
      )}

      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{message}</p>
        {action && (
          <button
            onClick={() => { action.onClick?.(); removeToast(id); }}
            className="text-xs font-semibold underline underline-offset-2 mt-1 hover:opacity-80 transition-opacity"
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => removeToast(id)}
        aria-label="Cerrar notificación"
        className="shrink-0 p-0.5 hover:opacity-60 transition-opacity text-current"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export default function ToastContainer() {
  const { toasts } = useUI();

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
