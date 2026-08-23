import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import Button from '../ui/Button';
import { useUI } from '../../context/UIContext';

/* ── Animaciones ─────────────────────────────────────────── */
const stepVariants = {
  enter: (dir) => ({
    x: dir > 0 ? 48 : -48,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (dir) => ({
    x: dir > 0 ? -48 : 48,
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.25 },
  }),
};

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

/* ── StepIndicator ───────────────────────────────────────── */
function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const done    = idx < currentStep;
        const active  = idx === currentStep;
        const pending = idx > currentStep;
        const isLast  = idx === steps.length - 1;

        return (
          <div key={idx} className="flex items-center">
            {/* Círculo */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                layout
                className={`
                  relative w-9 h-9 rounded-full flex items-center justify-center
                  text-sm font-semibold border-2 transition-colors duration-300
                  ${done    ? 'bg-blue-600 border-blue-600 text-white' : ''}
                  ${active  ? 'bg-blue-600/20 border-blue-500 text-blue-400' : ''}
                  ${pending ? 'bg-white/5 border-white/15 text-slate-500' : ''}
                `}
              >
                {done ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <Check size={16} />
                  </motion.div>
                ) : (
                  <span>{idx + 1}</span>
                )}

                {/* Ring pulsante en activo */}
                {active && (
                  <span className="absolute inset-0 rounded-full border-2 border-blue-500 animate-ping opacity-30" />
                )}
              </motion.div>

              {/* Label */}
              <span className={`text-[10px] font-medium whitespace-nowrap leading-tight text-center max-w-[72px]
                ${active ? 'text-blue-400' : done ? 'text-slate-300' : 'text-slate-600'}`}
              >
                {step.label}
              </span>
            </div>

            {/* Línea conectora */}
            {!isLast && (
              <div className="relative w-12 sm:w-16 h-0.5 mx-1 mb-5 bg-white/10 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── WizardShell ─────────────────────────────────────────── */
/**
 * Wizard multi-paso reutilizable con validación por paso.
 *
 * Props:
 *  - steps: [{ label, icon?, description?, component: JSX, validate?: async () => true|string }]
 *  - title: string
 *  - subtitle?: string
 *  - onComplete: async (data) => void
 *  - onCancel?: () => void
 *  - storageKey?: string  → persiste step en sessionStorage
 *  - fullscreen?: boolean → usa todo el viewport (default false → max-w-3xl centrado)
 *  - data: object         → datos compartidos entre pasos
 *  - setData: fn          → setter de datos
 */
export default function WizardShell({
  steps = [],
  title = 'Asistente',
  subtitle,
  onComplete,
  onCancel,
  storageKey,
  fullscreen = false,
  data = {},
  setData,
}) {
  const { confirm, toast } = useUI();

  /* Restore step from sessionStorage */
  const [currentStep, setCurrentStep] = useState(() => {
    if (!storageKey) return 0;
    try {
      const saved = sessionStorage.getItem(`wizard_step_${storageKey}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch { return 0; }
  });

  const [dir, setDir]           = useState(1);
  const [validating, setValidating] = useState(false);
  const [error, setError]       = useState(null);
  const [completing, setCompleting] = useState(false);

  const isFirst = currentStep === 0;
  const isLast  = currentStep === steps.length - 1;
  const step    = steps[currentStep];

  /* Persist step */
  useEffect(() => {
    if (!storageKey) return;
    try { sessionStorage.setItem(`wizard_step_${storageKey}`, String(currentStep)); } catch { /* ignore */ }
  }, [currentStep, storageKey]);

  /* Keyboard → Enter avanza, Esc cancela */
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') handleCancel();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCancel]);

  /* ── Navegación ──────────────────────────────────────── */
  const goNext = useCallback(async () => {
    setError(null);

    if (step?.validate) {
      setValidating(true);
      try {
        const result = await step.validate(data);
        if (result !== true) {
          setError(typeof result === 'string' ? result : 'Completa los campos requeridos antes de continuar.');
          setValidating(false);
          return;
        }
      } catch (err) {
        setError('Error al validar. Inténtalo de nuevo.');
        setValidating(false);
        return;
      }
      setValidating(false);
    }

    if (isLast) {
      /* Completar */
      setCompleting(true);
      try {
        await onComplete?.(data);
        if (storageKey) {
          try { sessionStorage.removeItem(`wizard_step_${storageKey}`); } catch { /* ignore */ }
        }
      } catch (err) {
        toast.error('Ocurrió un error al guardar. Inténtalo nuevamente.');
      } finally {
        setCompleting(false);
      }
    } else {
      setDir(1);
      setCurrentStep(s => s + 1);
    }
  }, [step, isLast, data, onComplete, storageKey, toast]);

  const goPrev = useCallback(() => {
    if (isFirst) return;
    setError(null);
    setDir(-1);
    setCurrentStep(s => s - 1);
  }, [isFirst]);

  const handleCancel = useCallback(async () => {
    const ok = await confirm({
      title:       'Salir del asistente',
      description: 'Perderás el progreso no guardado. ¿Deseas salir?',
      confirmText: 'Salir',
      danger:      false,
    });
    if (ok) {
      if (storageKey) {
        try { sessionStorage.removeItem(`wizard_step_${storageKey}`); } catch { /* ignore */ }
      }
      onCancel?.();
    }
  }, [confirm, onCancel, storageKey]);

  if (!steps.length) return null;

  const StepComponent = step?.component;

  return (
    <AnimatePresence>
      <motion.div
        key="wizard-overlay"
        variants={overlayVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`
          fixed inset-0 z-[150] flex flex-col
          ${fullscreen ? 'bg-[#0F172A]' : 'bg-black/80 backdrop-blur-sm items-center justify-center p-4'}
        `}
      >
        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }}
          className={`
            relative flex flex-col bg-slate-900/98 backdrop-blur-2xl
            border border-white/10 shadow-2xl shadow-black/60
            ${fullscreen
              ? 'w-full h-full rounded-none'
              : 'w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden'
            }
          `}
        >
          {/* ── Header ───────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8 flex-shrink-0">
            {/* Logo/Ícono si existe */}
            <div className="flex items-center gap-3">
              {step?.icon && (
                <div className="p-2 bg-blue-500/15 rounded-xl border border-blue-500/25">
                  <step.icon size={20} className="text-blue-400" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>

            {/* Badge de paso */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 hidden sm:block">
                Paso {currentStep + 1} de {steps.length}
              </span>
              <button
                onClick={handleCancel}
                aria-label="Cerrar asistente"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-200
                  hover:bg-white/8 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Step Indicator ───────────────────────────── */}
          <div className="px-6 pt-6 flex-shrink-0">
            <StepIndicator steps={steps} currentStep={currentStep} />
          </div>

          {/* ── Descripción del paso ─────────────────────── */}
          {step?.description && (
            <div className="px-6 mb-4 flex-shrink-0">
              <p className="text-sm text-slate-400 text-center">{step.description}</p>
            </div>
          )}

          {/* ── Contenido del paso (animado) ─────────────── */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={currentStep}
                custom={dir}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {StepComponent && (
                  <StepComponent
                    data={data}
                    setData={setData}
                    onNext={goNext}
                    onPrev={goPrev}
                    stepIndex={currentStep}
                    totalSteps={steps.length}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Error banner ─────────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-6 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-xl
                  bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
              >
                <AlertTriangle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Footer / Navegación ───────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/8 flex-shrink-0 gap-3">
            {/* Anterior */}
            <Button
              variant="secondary"
              size="md"
              onClick={goPrev}
              disabled={isFirst || validating || completing}
              leftIcon={<ChevronLeft size={16} />}
            >
              Anterior
            </Button>

            {/* Indicador puntos en mobile */}
            <div className="flex gap-1.5 sm:hidden">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300
                    ${i === currentStep ? 'w-5 bg-blue-500' : 'w-1.5 bg-white/20'}`}
                />
              ))}
            </div>

            {/* Siguiente / Finalizar */}
            <Button
              variant={isLast ? 'gold' : 'primary'}
              size="md"
              onClick={goNext}
              loading={validating || completing}
              rightIcon={isLast ? <Check size={16} /> : <ChevronRight size={16} />}
            >
              {isLast ? 'Finalizar' : 'Siguiente'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Hook helpers ────────────────────────────────────────── */
/**
 * useWizard — Maneja el estado de datos del wizard.
 * const { data, setData, updateField } = useWizard({ step1Default: '', step2Default: '' });
 */
/* eslint-disable-next-line react-refresh/only-export-components */
export function useWizard(initialData = {}) {
  const [data, setData] = useState(initialData);

  const updateField = useCallback((key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetData = useCallback(() => setData(initialData), [initialData]);

  return { data, setData, updateField, resetData };
}
